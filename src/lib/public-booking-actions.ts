"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildWhatsAppUrl, renderMessageTemplate } from "@/lib/whatsapp";
import { z } from "zod";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  buildBookingPixPayload,
  createMercadoPagoBookingPayment,
  expireStaleBookingCheckouts,
  fetchBookingMercadoPagoPayment,
  getCheckoutExpiryDate,
  getDayOccupancy,
  isBookingMercadoPagoConfigured,
  isCheckoutExpired,
  markCheckoutExpired,
  resolveBarberId,
  validatePublicBookingSlot,
} from "@/lib/booking-checkout";
import { isBookingDemoMode } from "@/lib/mercadopago";
import { credentialConfigured, prepareCredentialForStorage } from "@/lib/crypto/credentials";
import { requireTenantAdmin, requireTenantUser } from "@/lib/authz";
import {
  assertMercadoPagoPaymentIdAvailable,
  validateApprovedMercadoPagoPayment,
} from "@/lib/domain/payment-validation";
import { logger } from "@/lib/logging/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request-ip";

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
    mercadoPagoConfigured: credentialConfigured(settings.mercadoPagoAccessToken),
  };
}

import {
  buildPublicBookingConfirmationResponse,
  finalizeBookingFromVerifiedPayment,
  notifyBarbershopBooking,
} from "@/lib/domain/booking-finalize";

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
    openTime: tenant.settings?.openTime ?? "07:00",
    closeTime: tenant.settings?.closeTime ?? "22:00",
    workingDays: tenant.settings?.workingDays ?? "1,2,3,4,5,6",
    bookingRequirePixPayment: tenant.settings?.bookingRequirePixPayment,
    bookingPixKey: tenant.settings?.bookingPixKey,
    bookingPixHolderName: tenant.settings?.bookingPixHolderName,
    bookingPixCity: tenant.settings?.bookingPixCity,
    mercadoPagoAccessToken: tenant.settings?.mercadoPagoAccessToken,
  });

  const autoPaymentEnabled = booking.mercadoPagoConfigured || isBookingDemoMode();

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

  const ip = await getClientIp();
  await consumeRateLimit({
    scope: "public_slots_query",
    identityParts: [ip, tenant.id],
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });

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

export async function processBookingMercadoPagoPayment(paymentId: string) {
  let checkout = await prisma.publicBookingCheckout.findFirst({
    where: { mercadoPagoPaymentId: String(paymentId) },
    include: { tenant: { include: { settings: true } } },
  });

  const storedToken = checkout?.tenant.settings?.mercadoPagoAccessToken ?? null;
  const payment = await fetchBookingMercadoPagoPayment(paymentId, storedToken);
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
  if (checkout.status === "PAID") return checkout.appointmentId;

  const validation = validateApprovedMercadoPagoPayment({
    payment: {
      status: payment.status,
      currency_id: payment.currency_id,
      transaction_amount: payment.transaction_amount,
      external_reference: payment.external_reference,
      id: payment.id,
    },
    expected: {
      externalReference: `bk_${checkout.id}`,
      amountDecimalOrString: checkout.amount,
      currency: "BRL",
    },
  });

  if (!validation.ok) {
    logger.warn("booking_payment_validation_failed", {
      action: "webhook.booking.payment_validation",
      checkoutId: checkout.id,
      paymentId,
      reason: validation.reason,
    });
    return null;
  }

  const paymentAvailability = await assertMercadoPagoPaymentIdAvailable(payment.id, {
    kind: "booking",
    checkoutId: checkout.id,
  });
  if (!paymentAvailability.ok) {
    logger.warn("booking_payment_id_conflict", {
      action: "webhook.booking.payment_id_conflict",
      checkoutId: checkout.id,
      paymentId,
    });
    return null;
  }

  await prisma.publicBookingCheckout.update({
    where: { id: checkout.id },
    data: { mercadoPagoPaymentId: String(payment.id) },
  });

  const result = await finalizeBookingFromVerifiedPayment(checkout.id, {
    paymentSource: "PAID_PROVIDER",
  });
  return result.appointment.id;
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

  const storedMercadoPagoToken = tenant.settings?.mercadoPagoAccessToken ?? null;
  const booking = getTenantBookingSettings({
    openTime: tenant.settings?.openTime ?? "07:00",
    closeTime: tenant.settings?.closeTime ?? "22:00",
    workingDays: tenant.settings?.workingDays ?? "1,2,3,4,5,6",
    bookingRequirePixPayment: tenant.settings?.bookingRequirePixPayment,
    bookingPixKey: tenant.settings?.bookingPixKey,
    bookingPixHolderName: tenant.settings?.bookingPixHolderName,
    bookingPixCity: tenant.settings?.bookingPixCity,
    mercadoPagoAccessToken: storedMercadoPagoToken,
  });

  if (
    booking.requirePixPayment &&
    !booking.pixKey &&
    !isBookingMercadoPagoConfigured(storedMercadoPagoToken)
  ) {
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

  const barber = parsed.barberId
    ? await prisma.user.findFirst({
        where: { id: parsed.barberId, tenantId: tenant.id, role: "BARBER", active: true },
        select: { name: true },
      })
    : null;

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
      serviceName: service.name,
      serviceDuration: service.duration,
      servicePrice: service.price,
      barberName: barber?.name ?? null,
      currency: "BRL",
    },
  });

  let copiaECola: string | null = null;
  let qrCodeBase64: string | null = null;
  let pixKey: string | null = booking.pixKey;
  let autoConfirm = false;

  if (isBookingMercadoPagoConfigured(storedMercadoPagoToken)) {
    try {
      const mpPayment = await createMercadoPagoBookingPayment({
        storedToken: storedMercadoPagoToken,
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
    const result = await finalizeBookingFromVerifiedPayment(checkout.id, {
      paymentSource: "DEMO",
    });
    const confirmed = buildPublicBookingConfirmationResponse(result);
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

  const storedMercadoPagoToken = checkout.tenant.settings?.mercadoPagoAccessToken ?? null;
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
    isBookingMercadoPagoConfigured(storedMercadoPagoToken)
  ) {
    const payment = await fetchBookingMercadoPagoPayment(
      checkout.mercadoPagoPaymentId,
      storedMercadoPagoToken
    );
    if (payment) {
      const validation = validateApprovedMercadoPagoPayment({
        payment: {
          status: payment.status,
          currency_id: payment.currency_id,
          transaction_amount: payment.transaction_amount,
          external_reference: payment.external_reference,
          id: payment.id,
        },
        expected: {
          externalReference: `bk_${checkout.id}`,
          amountDecimalOrString: checkout.amount,
          currency: "BRL",
        },
      });

      if (validation.ok) {
        const paymentAvailability = await assertMercadoPagoPaymentIdAvailable(payment.id, {
          kind: "booking",
          checkoutId: checkout.id,
        });

        if (paymentAvailability.ok) {
          await prisma.publicBookingCheckout.update({
            where: { id: checkout.id },
            data: { mercadoPagoPaymentId: String(payment.id) },
          });

          await finalizeBookingFromVerifiedPayment(checkout.id, {
            paymentSource: "PAID_PROVIDER",
          });
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
    }
  }

  const booking = getTenantBookingSettings({
    openTime: checkout.tenant.settings?.openTime ?? "07:00",
    closeTime: checkout.tenant.settings?.closeTime ?? "22:00",
    workingDays: checkout.tenant.settings?.workingDays ?? "1,2,3,4,5,6",
    bookingPixKey: checkout.tenant.settings?.bookingPixKey,
    bookingPixHolderName: checkout.tenant.settings?.bookingPixHolderName,
    bookingPixCity: checkout.tenant.settings?.bookingPixCity,
    mercadoPagoAccessToken: storedMercadoPagoToken,
  });

  let copiaECola: string | null = null;
  let qrCodeBase64: string | null = null;

  if (checkout.mercadoPagoPaymentId && checkout.status === "PENDING_PAYMENT") {
    const payment = await fetchBookingMercadoPagoPayment(
      checkout.mercadoPagoPaymentId,
      storedMercadoPagoToken
    );
    copiaECola = payment?.point_of_interaction?.transaction_data?.qr_code ?? null;
    qrCodeBase64 = payment?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
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
    serviceName: service?.name ?? checkout.serviceName ?? "Serviço",
    scheduledAt: checkout.scheduledAt.toISOString(),
    expiresAt: checkout.expiresAt.toISOString(),
    barbershopName: checkout.tenant.name,
    clientName: checkout.clientName,
    copiaECola,
    qrCodeBase64,
    pixKey: booking.pixKey,
    holderName: booking.pixHolderName || checkout.tenant.name,
    autoConfirm: booking.mercadoPagoConfigured,
    clientWaUrl: clientMessage ? buildWhatsAppUrl(phone, clientMessage) : null,
  };
}

export async function reportPublicBookingPaid(slug: string, checkoutId: string) {
  const ip = await getClientIp();
  await consumeRateLimit({
    scope: "public_booking_paid_report",
    identityParts: [ip, checkoutId],
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

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
    isBookingMercadoPagoConfigured(checkout.tenant.settings?.mercadoPagoAccessToken) ||
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

  const ip = await getClientIp();
  const rawPhone = String(formData.get("clientPhone") || "").replace(/\D/g, "");
  await consumeRateLimit({
    scope: "public_booking_create_ip",
    identityParts: [ip],
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  await consumeRateLimit({
    scope: "public_booking_create_phone",
    identityParts: [tenant.id, rawPhone],
    limit: 4,
    windowMs: 60 * 60 * 1000,
  });

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
    openTime: tenant.settings?.openTime ?? "07:00",
    closeTime: tenant.settings?.closeTime ?? "22:00",
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

  const { createAppointmentWithConflictGuard } = await import(
    "@/lib/domain/appointment-create"
  );
  const appointment = await createAppointmentWithConflictGuard({
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
    origin: "PUBLIC",
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
    paid: false,
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

export async function getAgendaOnlineItems() {
  const user = await requireTenantUser();
  const tenantId = user.tenantId;

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
      serviceName: checkout.serviceName ?? serviceMap.get(checkout.serviceId) ?? "Serviço",
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
  const user = await requireTenantAdmin();
  const tenantId = user.tenantId;

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
    serviceName: checkout.serviceName ?? serviceMap.get(checkout.serviceId) ?? "Serviço",
    scheduledAt: checkout.scheduledAt.toISOString(),
    amount: Number(checkout.amount),
    expiresAt: checkout.expiresAt.toISOString(),
  }));
}

export async function confirmPendingBookingCheckout(checkoutId: string) {
  const user = await requireTenantAdmin();
  const tenantId = user.tenantId;

  const checkout = await prisma.publicBookingCheckout.findFirst({
    where: {
      id: checkoutId,
      tenantId,
      status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] },
    },
  });
  if (!checkout) throw new Error("Reserva não encontrada");

  await finalizeBookingFromVerifiedPayment(checkoutId, {
    confirmedByUserId: user.id,
    paymentSource: "PAID_MANUAL",
  });
  revalidatePath("/agenda");
  return { success: true };
}

export async function updatePublicBookingSettings(formData: FormData) {
  const user = await requireTenantAdmin();
  const tenantId = user.tenantId;

  const existing = await prisma.tenantSettings.findUnique({ where: { tenantId } });

  const publicBookingEnabled = formData.get("publicBookingEnabled") === "on";
  const bookingRequirePixPayment = formData.get("bookingRequirePixPayment") === "on";
  const bookingNotifyPhone = String(formData.get("bookingNotifyPhone") || "").trim() || null;
  const bookingPixKey = String(formData.get("bookingPixKey") || "").trim() || null;
  const bookingPixHolderName = String(formData.get("bookingPixHolderName") || "").trim() || null;
  const bookingPixCity = String(formData.get("bookingPixCity") || "").trim() || "SAO PAULO";
  const newMercadoPagoAccessToken = String(formData.get("newMercadoPagoAccessToken") || "").trim();

  const mercadoPagoAccessToken = prepareCredentialForStorage(
    newMercadoPagoAccessToken || null,
    existing?.mercadoPagoAccessToken
  );

  if (bookingRequirePixPayment && !bookingPixKey && !credentialConfigured(mercadoPagoAccessToken)) {
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
