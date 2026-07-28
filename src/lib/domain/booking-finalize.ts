import "server-only";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canUseAutoWhatsApp } from "@/lib/plan-pricing";
import { buildWhatsAppUrl, renderMessageTemplate, sendWhatsAppText } from "@/lib/whatsapp";
import { formatCurrency, formatPhone } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  isCheckoutExpired,
  markCheckoutExpired,
  resolveBarberId,
  validatePublicBookingSlot,
} from "@/lib/booking-checkout";
import { createAppointmentWithConflictGuard } from "@/lib/domain/appointment-create";

export type FinalizedBookingResult = {
  checkout: Awaited<ReturnType<typeof loadCheckoutForFinalize>>;
  appointment: NonNullable<Awaited<ReturnType<typeof loadCheckoutForFinalize>>> extends infer C
    ? C extends { appointment: infer A }
      ? A extends null
        ? never
        : A
      : never
    : never;
  client: { id: string; name: string; phone: string };
  service: { id: string; name: string; duration: number; price: unknown };
  phone: string;
};

async function loadCheckoutForFinalize(checkoutId: string) {
  return prisma.publicBookingCheckout.findUnique({
    where: { id: checkoutId },
    include: {
      tenant: { include: { settings: true } },
      appointment: { include: { client: true, service: true } },
    },
  });
}

export async function notifyBarbershopBooking(options: {
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

export async function finalizeBookingFromVerifiedPayment(
  checkoutId: string,
  options?: {
    confirmedByUserId?: string;
    paymentSource?: string;
    confirmationNote?: string;
  }
) {
  const checkout = await loadCheckoutForFinalize(checkoutId);

  if (!checkout) throw new Error("Reserva não encontrada");

  if (checkout.status === "PAID" && checkout.appointmentId && checkout.appointment) {
    return {
      checkout,
      appointment: checkout.appointment,
      client: checkout.appointment.client,
      service: checkout.appointment.service,
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
  const bookingSettings = {
    openTime: settings?.openTime ?? "08:00",
    closeTime: settings?.closeTime ?? "20:00",
    workingDays: settings?.workingDays ?? "1,2,3,4,5,6",
  };

  const { barbers, dayAppointments } = await validatePublicBookingSlot({
    tenantId: checkout.tenantId,
    serviceId: checkout.serviceId,
    barberId: checkout.barberId,
    scheduledAt: checkout.scheduledAt,
    settings: bookingSettings,
    excludeCheckoutId: checkoutId,
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

  const appointment = await createAppointmentWithConflictGuard({
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
    origin: "PUBLIC",
    checkoutId,
    excludeCheckoutId: checkoutId,
    afterCreate: async (tx, apt) => {
      await tx.publicBookingCheckout.update({
        where: { id: checkoutId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          appointmentId: apt.id,
          paymentSource: options?.paymentSource ?? "PAID_PROVIDER",
          confirmedByUserId: options?.confirmedByUserId ?? null,
          confirmationNote: options?.confirmationNote ?? null,
        },
      });
    },
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

  try {
    revalidatePath("/agenda");
    revalidatePath("/dashboard");
  } catch {
    // Outside Next request context (webhooks/tests) revalidate is unavailable
  }

  return { checkout, appointment, client, service, phone };
}

export function buildPublicBookingConfirmationResponse(result: {
  checkout: { scheduledAt: Date; tenant: { name: string } };
  appointment: { id: string };
  client: { name: string };
  service: { name: string };
  phone: string;
}) {
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
