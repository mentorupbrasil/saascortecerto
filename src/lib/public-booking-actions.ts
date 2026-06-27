"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canUseAutoWhatsApp } from "@/lib/plan-pricing";
import { buildWhatsAppUrl, renderMessageTemplate, sendWhatsAppText } from "@/lib/whatsapp";
import { formatCurrency, formatPhone } from "@/lib/utils";
import { z } from "zod";
import { parseISO, startOfDay, endOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  buildBookingPixPayload,
  createMercadoPagoBookingPayment,
  expireStaleBookingCheckouts,
  getBookingMercadoPagoToken,
  getCheckoutExpiryDate,
  getDayOccupancy,
  isCheckoutExpired,
  markCheckoutExpired,
  resolveBarberId,
  validatePublicBookingSlot,
} from "@/lib/booking-checkout";
import { fetchMercadoPagoPayment, isBookingDemoMode } from "@/lib/mercadopago";

const publicBookingSchema = z.object({
  clientName: z.string().min(2),
  clientPhone: z.string().min(10),
  serviceId: z.string(),
  barberId: z.string().optional(),
  scheduledAt: z.string(),
});

function getTenantBookingSettings(settings: {
  openTime: string;
  closeTime: string;
  workingDays: string;
  bookingRequirePixPayment?: boolean;
  bookingPixKey?: string | null;
  bookingPixHolderName?: string | null;
  bookingPixCity?: string | null;
  mercadoPagoAccessToken?: string | null;
}) {
  return {
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    workingDays: settings.workingDays,
    requirePixPayment: settings.bookingRequirePixPayment ?? false,
    pixKey: settings.bookingPixKey?.trim() || null,
    pixHolderName: settings.bookingPixHolderName?.trim() || null,
    pixCity: settings.bookingPixCity?.trim() || "SAO PAULO",
    mercadoPagoAccessToken: settings.mercadoPagoAccessToken?.trim() || null,
  };
}

export async function getPublicBookingPage(slug: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { slug, active: true },
    include: {
      settings: true,
      services: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      users: {
        where: { role: "BARBER", active: true },
        select: { id: true, name: true },
      },
    },
  });

  if (!tenant) return null;
  if (tenant.settings && !tenant.settings.publicBookingEnabled) return null;

  const booking = getTenantBookingSettings({
    openTime: tenant.settings?.openTime ?? "08:00",
    closeTime: tenant.settings?.closeTime ?? "20:00",
    workingDays: tenant.settings?.workingDays ?? "1,2,3,4,5,6",
    bookingRequirePixPayment: tenant.settings?.bookingRequirePixPayment,
    bookingPixKey: tenant.settings?.bookingPixKey,
    bookingPixHolderName: tenant.settings?.bookingPixHolderName,
    bookingPixCity: tenant.settings?.bookingPixCity,
    mercadoPagoAccessToken: tenant.settings?.mercadoPagoAccessToken,
  });

  const autoPaymentEnabled =
    !!getBookingMercadoPagoToken(booking.mercadoPagoAccessToken) || isBookingDemoMode();

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    phone: tenant.phone,
    address: tenant.address,
    openTime: booking.openTime,
    closeTime: booking.closeTime,
    workingDays: booking.workingDays,
    requirePixPayment: booking.requirePixPayment,
    pixPaymentReady: booking.requirePixPayment
      ? !!booking.pixKey || autoPaymentEnabled
      : true,
    autoPaymentEnabled,
    services: tenant.services.map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
      duration: s.duration,
    })),
    barbers: tenant.users,
  };
}

export async function getPublicAvailableSlots(
  slug: string,
  dateStr: string,
  serviceId: string,
  barberId?: string
) {
  const tenant = await getPublicBookingPage(slug);
  if (!tenant) throw new Error("Barbearia não encontrada");

  const service = tenant.services.find((s) => s.id === serviceId);
  if (!service) throw new Error("Serviço não encontrado");

  const date = parseISO(dateStr);
  const { appointments, barbers } = await getDayOccupancy(tenant.id, date, {
    openTime: tenant.openTime,
    closeTime: tenant.closeTime,
    workingDays: tenant.workingDays,
  });

  const { getAvailableSlots } = await import("@/lib/booking-slots");
  const slots = getAvailableSlots({
    date,
    openTime: tenant.openTime,
    closeTime: tenant.closeTime,
    workingDays: tenant.workingDays,
    serviceDuration: service.duration,
    appointments,
    barberId: barberId || null,
    barberIds: barbers.map((b) => b.id),
  });

  return slots;
}

async function notifyBarbershopBooking(options: {
  tenantId: string;
  tenantName: string;
  plan: "FREE" | "PRO" | "CLUBE";
  clientName: string;
  clientPhone: string;
  serviceName: string;
  scheduledAt: Date;
  price: number;
  paid?: boolean;
}) {
  const [settings, tenant] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId: options.tenantId } }),
    prisma.tenant.findUnique({
      where: { id: options.tenantId },
      select: { phone: true },
    }),
  ]);

  const notifyPhone = (settings?.bookingNotifyPhone || tenant?.phone || "").replace(/\D/g, "");
  if (!notifyPhone) {
    return { notified: false, waUrl: null };
  }

  const when = format(options.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const template = options.paid
    ? "✅ *Agendamento confirmado (PIX pago)!*\n\nCliente: {nome}\nTel: {telefone}\nServiço: {servico}\nHorário: {horario}\nValor: {valor}\n\n— CorteCerto"
    : "📅 *Novo agendamento online!*\n\nCliente: {nome}\nTel: {telefone}\nServiço: {servico}\nHorário: {horario}\nValor: {valor}\n\n— CorteCerto";

  const message = renderMessageTemplate(template, {
    nome: options.clientName,
    telefone: formatPhone(options.clientPhone),
    servico: options.serviceName,
    horario: when,
    valor: formatCurrency(options.price),
  });

  let status: "SENT" | "SIMULATED" | "FAILED" | "PENDING" = "PENDING";
  let error: string | undefined;

  if (settings && canUseAutoWhatsApp(options.plan) && settings.whatsappEnabled) {
    const result = await sendWhatsAppText(settings, notifyPhone, message);
    if (result.success) {
      status = result.simulated ? "SIMULATED" : "SENT";
    } else {
      status = "FAILED";
      error = result.error;
    }
  }

  await prisma.whatsAppMessage.create({
    data: {
      tenantId: options.tenantId,
      phone: notifyPhone,
      message,
      type: "CONFIRMATION",
      status,
      error,
      sentAt: status === "SENT" || status === "SIMULATED" ? new Date() : null,
    },
  });

  return {
    notified: status === "SENT" || status === "SIMULATED",
    waUrl: buildWhatsAppUrl(notifyPhone, message),
  };
}

async function finalizeBookingFromCheckout(checkoutId: string) {
  const checkout = await prisma.publicBookingCheckout.findUnique({
    where: { id: checkoutId },
    include: { tenant: { include: { settings: true } } },
  });

  if (!checkout) throw new Error("Reserva não encontrada");
  if (checkout.status === "PAID" && checkout.appointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: checkout.appointmentId },
      include: { client: true, service: true },
    });
    if (!appointment) throw new Error("Agendamento não encontrado");
    return {
      checkout,
      appointment,
      client: appointment.client,
      service: appointment.service,
      phone: checkout.clientPhone,
    };
  }
  if (checkout.status === "EXPIRED" || isCheckoutExpired(checkout.expiresAt)) {
    await markCheckoutExpired(checkoutId);
    throw new Error("Reserva expirada. Escolha o horário novamente.");
  }

  const service = await prisma.service.findFirst({
    where: { id: checkout.serviceId, tenantId: checkout.tenantId, active: true },
  });
  if (!service) throw new Error("Serviço inválido");

  const settings = checkout.tenant.settings;
  const bookingSettings = getTenantBookingSettings({
    openTime: settings?.openTime ?? "08:00",
    closeTime: settings?.closeTime ?? "20:00",
    workingDays: settings?.workingDays ?? "1,2,3,4,5,6",
  });

  const { barbers, dayAppointments } = await validatePublicBookingSlot({
    tenantId: checkout.tenantId,
    serviceId: checkout.serviceId,
    barberId: checkout.barberId,
    scheduledAt: checkout.scheduledAt,
    settings: bookingSettings,
  });

  const phone = checkout.clientPhone.replace(/\D/g, "");

  let client = await prisma.client.findUnique({
    where: { tenantId_phone: { tenantId: checkout.tenantId, phone } },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        tenantId: checkout.tenantId,
        name: checkout.clientName,
        phone,
      },
    });
  } else if (client.name !== checkout.clientName) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: { name: checkout.clientName },
    });
  }

  const barberId = await resolveBarberId({
    tenantId: checkout.tenantId,
    barberId: checkout.barberId,
    scheduledAt: checkout.scheduledAt,
    serviceDuration: service.duration,
    dayAppointments,
    barbers,
  });

  const appointment = await prisma.$transaction(async (tx) => {
    const apt = await tx.appointment.create({
      data: {
        tenantId: checkout.tenantId,
        clientId: client!.id,
        serviceId: service.id,
        barberId,
        scheduledAt: checkout.scheduledAt,
        duration: service.duration,
        price: checkout.amount,
        paymentMethod: "PIX",
        status: "CONFIRMED",
        bookedOnline: true,
        notes: "Agendamento online — PIX confirmado",
      },
    });

    await tx.publicBookingCheckout.update({
      where: { id: checkoutId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        appointmentId: apt.id,
      },
    });

    return apt;
  });

  await notifyBarbershopBooking({
    tenantId: checkout.tenantId,
    tenantName: checkout.tenant.name,
    plan: checkout.tenant.plan,
    clientName: client.name,
    clientPhone: phone,
    serviceName: service.name,
    scheduledAt: checkout.scheduledAt,
    price: Number(checkout.amount),
    paid: true,
  });

  revalidatePath("/agenda");
  revalidatePath("/dashboard");

  return { checkout, appointment, client, service, phone };
}

export async function confirmPublicBookingCheckout(checkoutId: string) {
  const result = await finalizeBookingFromCheckout(checkoutId);
  const when = format(result.checkout.scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR });
  const clientMessage = renderMessageTemplate(
    "Olá {nome}! Seu horário na {barbearia} está confirmado para {horario}. Serviço: {servico}. Pagamento recebido. Te esperamos! ✂️",
    {
      nome: result.client.name.split(" ")[0],
      barbearia: result.checkout.tenant.name,
      horario: when,
      servico: result.service.name,
    }
  );

  return {
    appointmentId: result.appointment.id,
    scheduledAt: result.checkout.scheduledAt.toISOString(),
    serviceName: result.service.name,
    barbershopName: result.checkout.tenant.name,
    clientWaUrl: buildWhatsAppUrl(result.phone, clientMessage),
  };
}

export async function processBookingMercadoPagoPayment(paymentId: string) {
  let checkout = await prisma.publicBookingCheckout.findFirst({
    where: { mercadoPagoPaymentId: String(paymentId) },
    include: { tenant: { include: { settings: true } } },
  });

  const token = checkout
    ? getBookingMercadoPagoToken(checkout.tenant.settings?.mercadoPagoAccessToken)
    : getBookingMercadoPagoToken(null);

  if (!token) return null;

  const payment = await fetchMercadoPagoPayment(paymentId, token);
  if (!payment) return null;

  if (payment.external_reference?.startsWith("bk_")) {
    const checkoutId = payment.external_reference.slice(3);
    if (!checkout) {
      checkout = await prisma.publicBookingCheckout.findUnique({
        where: { id: checkoutId },
        include: { tenant: { include: { settings: true } } },
      });
    }
  }

  if (!checkout) return null;
  if (payment.status !== "approved") return null;
  if (checkout.status === "PAID") return checkout.appointmentId;

  await prisma.publicBookingCheckout.update({
    where: { id: checkout.id },
    data: { mercadoPagoPaymentId: String(payment.id) },
  });

  const result = await confirmPublicBookingCheckout(checkout.id);
  return result.appointmentId;
}

export async function createPublicBookingCheckout(slug: string, formData: FormData) {
  const parsed = publicBookingSchema.parse({
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    serviceId: formData.get("serviceId"),
    barberId: formData.get("barberId") || undefined,
    scheduledAt: formData.get("scheduledAt"),
  });

  const tenant = await prisma.tenant.findFirst({
    where: { slug, active: true },
    include: { settings: true },
  });

  if (!tenant) throw new Error("Barbearia não encontrada");
  if (tenant.settings && !tenant.settings.publicBookingEnabled) {
    throw new Error("Agendamento online desativado");
  }

  const booking = getTenantBookingSettings({
    openTime: tenant.settings?.openTime ?? "08:00",
    closeTime: tenant.settings?.closeTime ?? "20:00",
    workingDays: tenant.settings?.workingDays ?? "1,2,3,4,5,6",
    bookingRequirePixPayment: tenant.settings?.bookingRequirePixPayment,
    bookingPixKey: tenant.settings?.bookingPixKey,
    bookingPixHolderName: tenant.settings?.bookingPixHolderName,
    bookingPixCity: tenant.settings?.bookingPixCity,
    mercadoPagoAccessToken: tenant.settings?.mercadoPagoAccessToken,
  });

  if (booking.requirePixPayment && !booking.pixKey && !getBookingMercadoPagoToken(booking.mercadoPagoAccessToken)) {
    throw new Error("Pagamento PIX não configurado pela barbearia.");
  }

  const scheduledAt = parseISO(parsed.scheduledAt);
  const { service } = await validatePublicBookingSlot({
    tenantId: tenant.id,
    serviceId: parsed.serviceId,
    barberId: parsed.barberId || null,
    scheduledAt,
    settings: booking,
  });

  const phone = parsed.clientPhone.replace(/\D/g, "");
  const amount = Number(service.price);
  const holderName = booking.pixHolderName || tenant.name;

  const checkout = await prisma.publicBookingCheckout.create({
    data: {
      tenantId: tenant.id,
      clientName: parsed.clientName.trim(),
      clientPhone: phone,
      serviceId: service.id,
      barberId: parsed.barberId || null,
      scheduledAt,
      amount: service.price,
      expiresAt: getCheckoutExpiryDate(),
    },
  });

  let copiaECola: string | null = null;
  let qrCodeBase64: string | null = null;
  let pixKey: string | null = booking.pixKey;
  let autoConfirm = false;

  const mpToken = getBookingMercadoPagoToken(booking.mercadoPagoAccessToken);
  if (mpToken) {
    try {
      const mpPayment = await createMercadoPagoBookingPayment({
        accessToken: mpToken,
        checkoutId: checkout.id,
        amount,
        description: `${service.name} — ${tenant.name}`,
        clientPhone: phone,
      });

      await prisma.publicBookingCheckout.update({
        where: { id: checkout.id },
        data: { mercadoPagoPaymentId: mpPayment.paymentId },
      });

      copiaECola = mpPayment.copiaECola;
      qrCodeBase64 = mpPayment.qrCodeBase64;
      autoConfirm = true;
    } catch (err) {
      console.error("Mercado Pago booking PIX error:", err);
      if (!booking.pixKey) throw new Error("Não foi possível gerar o PIX. Tente novamente.");
    }
  }

  if (!copiaECola && booking.pixKey) {
    const pixPayload = buildBookingPixPayload({
      pixKey: booking.pixKey,
      holderName,
      city: booking.pixCity,
      amount,
      checkoutId: checkout.id,
    });
    copiaECola = pixPayload.copiaECola;
    pixKey = pixPayload.pixKey;
  }

  if (isBookingDemoMode()) {
    const confirmed = await confirmPublicBookingCheckout(checkout.id);
    return {
      checkoutId: checkout.id,
      demoConfirmed: true,
      requiresPayment: false as const,
      scheduledAt: confirmed.scheduledAt,
      serviceName: confirmed.serviceName,
      clientWaUrl: confirmed.clientWaUrl,
    };
  }

  return {
    checkoutId: checkout.id,
    requiresPayment: true as const,
    amount,
    serviceName: service.name,
    scheduledAt: scheduledAt.toISOString(),
    expiresAt: checkout.expiresAt.toISOString(),
    copiaECola,
    qrCodeBase64,
    pixKey,
    holderName,
    autoConfirm,
  };
}

export async function getPublicBookingCheckoutPublic(slug: string, checkoutId: string) {
  await expireStaleBookingCheckouts();

  const checkout = await prisma.publicBookingCheckout.findFirst({
    where: { id: checkoutId, tenant: { slug } },
    include: {
      tenant: { include: { settings: true } },
      appointment: { include: { service: true } },
    },
  });

  if (!checkout) return null;

  const service = checkout.appointment?.service
    ? checkout.appointment.service
    : await prisma.service.findUnique({
        where: { id: checkout.serviceId },
        select: { name: true },
      });

  if (isCheckoutExpired(checkout.expiresAt) && checkout.status !== "PAID") {
    await markCheckoutExpired(checkout.id);
    checkout.status = "EXPIRED";
  }

  if (
    checkout.mercadoPagoPaymentId &&
    checkout.status === "PENDING_PAYMENT" &&
    getBookingMercadoPagoToken(checkout.tenant.settings?.mercadoPagoAccessToken)
  ) {
    const token = getBookingMercadoPagoToken(checkout.tenant.settings?.mercadoPagoAccessToken);
    const payment = await fetchMercadoPagoPayment(checkout.mercadoPagoPaymentId, token!);
    if (payment?.status === "approved") {
      await confirmPublicBookingCheckout(checkout.id);
      const refreshed = await prisma.publicBookingCheckout.findUnique({
        where: { id: checkoutId },
        include: {
          tenant: { include: { settings: true } },
          appointment: { include: { service: true } },
        },
      });
      if (refreshed) Object.assign(checkout, refreshed);
    }
  }

  const booking = getTenantBookingSettings({
    openTime: checkout.tenant.settings?.openTime ?? "08:00",
    closeTime: checkout.tenant.settings?.closeTime ?? "20:00",
    workingDays: checkout.tenant.settings?.workingDays ?? "1,2,3,4,5,6",
    bookingPixKey: checkout.tenant.settings?.bookingPixKey,
    bookingPixHolderName: checkout.tenant.settings?.bookingPixHolderName,
    bookingPixCity: checkout.tenant.settings?.bookingPixCity,
    mercadoPagoAccessToken: checkout.tenant.settings?.mercadoPagoAccessToken,
  });

  let copiaECola: string | null = null;
  let qrCodeBase64: string | null = null;

  if (checkout.mercadoPagoPaymentId && checkout.status === "PENDING_PAYMENT") {
    const token = getBookingMercadoPagoToken(booking.mercadoPagoAccessToken);
    if (token) {
      const payment = await fetchMercadoPagoPayment(checkout.mercadoPagoPaymentId, token);
      copiaECola = payment?.point_of_interaction?.transaction_data?.qr_code ?? null;
      qrCodeBase64 = payment?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    }
  }

  if (!copiaECola && booking.pixKey && checkout.status === "PENDING_PAYMENT") {
    copiaECola = buildBookingPixPayload({
      pixKey: booking.pixKey,
      holderName: booking.pixHolderName || checkout.tenant.name,
      city: booking.pixCity,
      amount: Number(checkout.amount),
      checkoutId: checkout.id,
    }).copiaECola;
  }

  const phone = checkout.clientPhone;
  const clientMessage =
    checkout.status === "PAID" && checkout.appointment
      ? renderMessageTemplate(
          "Olá {nome}! Seu horário na {barbearia} está confirmado para {horario}. Serviço: {servico}. Te esperamos! ✂️",
          {
            nome: checkout.clientName.split(" ")[0],
            barbearia: checkout.tenant.name,
            horario: format(checkout.scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR }),
            servico: checkout.appointment.service.name,
          }
        )
      : null;

  return {
    id: checkout.id,
    status: checkout.status,
    amount: Number(checkout.amount),
    serviceName: service?.name ?? "Serviço",
    scheduledAt: checkout.scheduledAt.toISOString(),
    expiresAt: checkout.expiresAt.toISOString(),
    barbershopName: checkout.tenant.name,
    clientName: checkout.clientName,
    copiaECola,
    qrCodeBase64,
    pixKey: booking.pixKey,
    holderName: booking.pixHolderName || checkout.tenant.name,
    autoConfirm: !!getBookingMercadoPagoToken(booking.mercadoPagoAccessToken),
    clientWaUrl: clientMessage ? buildWhatsAppUrl(phone, clientMessage) : null,
  };
}

export async function reportPublicBookingPaid(slug: string, checkoutId: string) {
  const checkout = await prisma.publicBookingCheckout.findFirst({
    where: { id: checkoutId, tenant: { slug } },
    include: { tenant: { include: { settings: true } } },
  });
  if (!checkout) throw new Error("Reserva não encontrada");
  if (checkout.status === "PAID") return { success: true };
  if (checkout.status === "EXPIRED" || isCheckoutExpired(checkout.expiresAt)) {
    throw new Error("Reserva expirada");
  }

  if (
    getBookingMercadoPagoToken(checkout.tenant.settings?.mercadoPagoAccessToken) ||
    checkout.mercadoPagoPaymentId
  ) {
    throw new Error("Aguarde a confirmação automática do PIX.");
  }

  await prisma.publicBookingCheckout.update({
    where: { id: checkoutId },
    data: { status: "AWAITING_CONFIRMATION" },
  });

  return { success: true };
}

export async function createPublicBooking(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findFirst({
    where: { slug, active: true },
    include: { settings: true },
  });

  if (!tenant) throw new Error("Barbearia não encontrada");

  const requirePix = tenant.settings?.bookingRequirePixPayment ?? false;
  if (requirePix) {
    const checkout = await createPublicBookingCheckout(slug, formData);
    if ("demoConfirmed" in checkout && checkout.demoConfirmed) {
      return {
        requiresPayment: false as const,
        scheduledAt: checkout.scheduledAt!,
        serviceName: checkout.serviceName!,
        clientWaUrl: checkout.clientWaUrl!,
      };
    }
    return checkout;
  }

  const parsed = publicBookingSchema.parse({
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    serviceId: formData.get("serviceId"),
    barberId: formData.get("barberId") || undefined,
    scheduledAt: formData.get("scheduledAt"),
  });

  const scheduledAt = parseISO(parsed.scheduledAt);
  const phone = parsed.clientPhone.replace(/\D/g, "");
  const bookingSettings = getTenantBookingSettings({
    openTime: tenant.settings?.openTime ?? "08:00",
    closeTime: tenant.settings?.closeTime ?? "20:00",
    workingDays: tenant.settings?.workingDays ?? "1,2,3,4,5,6",
  });

  const { service, barbers, dayAppointments } = await validatePublicBookingSlot({
    tenantId: tenant.id,
    serviceId: parsed.serviceId,
    barberId: parsed.barberId || null,
    scheduledAt,
    settings: bookingSettings,
  });

  let client = await prisma.client.findUnique({
    where: { tenantId_phone: { tenantId: tenant.id, phone } },
  });

  if (!client) {
    client = await prisma.client.create({
      data: { tenantId: tenant.id, name: parsed.clientName, phone },
    });
  } else if (client.name !== parsed.clientName) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: { name: parsed.clientName },
    });
  }

  const barberId = await resolveBarberId({
    tenantId: tenant.id,
    barberId: parsed.barberId || null,
    scheduledAt,
    serviceDuration: service.duration,
    dayAppointments,
    barbers,
  });

  const appointment = await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId,
      scheduledAt,
      duration: service.duration,
      price: service.price,
      status: "SCHEDULED",
      bookedOnline: true,
      notes: "Agendamento online",
    },
  });

  await notifyBarbershopBooking({
    tenantId: tenant.id,
    tenantName: tenant.name,
    plan: tenant.plan,
    clientName: client.name,
    clientPhone: phone,
    serviceName: service.name,
    scheduledAt,
    price: Number(service.price),
  });

  revalidatePath("/agenda");
  revalidatePath("/dashboard");

  const clientMessage = renderMessageTemplate(
    "Olá {nome}! Seu horário na {barbearia} está reservado para {horario}. Serviço: {servico}. Te esperamos! ✂️",
    {
      nome: client.name.split(" ")[0],
      barbearia: tenant.name,
      horario: format(scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR }),
      servico: service.name,
    }
  );

  return {
    requiresPayment: false as const,
    appointmentId: appointment.id,
    scheduledAt: scheduledAt.toISOString(),
    serviceName: service.name,
    barbershopName: tenant.name,
    clientWaUrl: buildWhatsAppUrl(phone, clientMessage),
  };
}

export async function getAgendaOnlineItems(tenantId: string) {
  const { expireStaleBookingCheckouts } = await import("@/lib/booking-checkout");
  await expireStaleBookingCheckouts(tenantId);

  const checkouts = await prisma.publicBookingCheckout.findMany({
    where: {
      tenantId,
      status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const serviceIds = [...new Set(checkouts.map((c) => c.serviceId))];
  const services =
    serviceIds.length > 0
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true },
        })
      : [];
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  const onlineAppointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      bookedOnline: true,
      status: { in: ["SCHEDULED"] },
      scheduledAt: { gte: new Date() },
    },
    include: { client: true, service: true },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });

  return {
    pendingCheckouts: checkouts.map((checkout) => ({
      id: checkout.id,
      status: checkout.status,
      clientName: checkout.clientName,
      clientPhone: checkout.clientPhone,
      serviceName: serviceMap.get(checkout.serviceId) ?? "Serviço",
      scheduledAt: checkout.scheduledAt.toISOString(),
      amount: Number(checkout.amount),
      expiresAt: checkout.expiresAt.toISOString(),
      autoPix: !!checkout.mercadoPagoPaymentId,
    })),
    onlineAppointments: onlineAppointments.map((apt) => ({
      id: apt.id,
      clientName: apt.client.name,
      serviceName: apt.service.name,
      scheduledAt: apt.scheduledAt.toISOString(),
      status: apt.status,
    })),
  };
}

export async function getPendingBookingCheckoutsForTenant() {
  const { requireAuth } = await import("@/lib/session");
  const { isTenantAdmin, requireTenantId } = await import("@/lib/auth-utils");

  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  await expireStaleBookingCheckouts(tenantId);

  const checkouts = await prisma.publicBookingCheckout.findMany({
    where: {
      tenantId,
      OR: [
        { status: "AWAITING_CONFIRMATION" },
        {
          status: "PENDING_PAYMENT",
          mercadoPagoPaymentId: null,
        },
      ],
      expiresAt: { gt: new Date() },
    },
    include: { tenant: { select: { name: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  const serviceIds = [...new Set(checkouts.map((c) => c.serviceId))];
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  return checkouts.map((checkout) => ({
    id: checkout.id,
    status: checkout.status,
    clientName: checkout.clientName,
    clientPhone: checkout.clientPhone,
    serviceName: serviceMap.get(checkout.serviceId) ?? "Serviço",
    scheduledAt: checkout.scheduledAt.toISOString(),
    amount: Number(checkout.amount),
    expiresAt: checkout.expiresAt.toISOString(),
  }));
}

export async function confirmPendingBookingCheckout(checkoutId: string) {
  const { requireAuth } = await import("@/lib/session");
  const { isTenantAdmin, requireTenantId } = await import("@/lib/auth-utils");

  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  const checkout = await prisma.publicBookingCheckout.findFirst({
    where: {
      id: checkoutId,
      tenantId,
      status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] },
    },
  });
  if (!checkout) throw new Error("Reserva não encontrada");

  await confirmPublicBookingCheckout(checkoutId);
  revalidatePath("/agenda");
  return { success: true };
}

export async function updatePublicBookingSettings(formData: FormData) {
  const { requireAuth } = await import("@/lib/session");
  const { isTenantAdmin, requireTenantId } = await import("@/lib/auth-utils");

  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  const publicBookingEnabled = formData.get("publicBookingEnabled") === "on";
  const bookingRequirePixPayment = formData.get("bookingRequirePixPayment") === "on";
  const bookingNotifyPhone = String(formData.get("bookingNotifyPhone") || "").trim() || null;
  const bookingPixKey = String(formData.get("bookingPixKey") || "").trim() || null;
  const bookingPixHolderName = String(formData.get("bookingPixHolderName") || "").trim() || null;
  const bookingPixCity = String(formData.get("bookingPixCity") || "").trim() || "SAO PAULO";
  const mercadoPagoAccessToken =
    String(formData.get("mercadoPagoAccessToken") || "").trim() || null;

  if (bookingRequirePixPayment && !bookingPixKey && !mercadoPagoAccessToken) {
    throw new Error("Informe a chave PIX ou o token Mercado Pago para exigir pagamento.");
  }

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      publicBookingEnabled,
      bookingRequirePixPayment,
      bookingNotifyPhone,
      bookingPixKey,
      bookingPixHolderName,
      bookingPixCity,
      mercadoPagoAccessToken,
    },
    update: {
      publicBookingEnabled,
      bookingRequirePixPayment,
      bookingNotifyPhone,
      bookingPixKey,
      bookingPixHolderName,
      bookingPixCity,
      mercadoPagoAccessToken,
    },
  });

  revalidatePath("/agenda");
  return { success: true };
}
