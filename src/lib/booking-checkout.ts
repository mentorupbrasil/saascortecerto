import "server-only";

import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/booking-slots";
import { generatePixCopiaECola } from "@/lib/pix";
import {
  createMercadoPagoPixPayment,
  fetchMercadoPagoPayment,
  getMercadoPagoAccessToken,
  isBookingDemoMode,
} from "@/lib/mercadopago";
import { parseISO, startOfDay, endOfDay, addMinutes } from "date-fns";

const CHECKOUT_HOLD_MINUTES = 15;

export function getBookingMercadoPagoToken(tenantToken?: string | null) {
  return tenantToken?.trim() || getMercadoPagoAccessToken();
}

export async function expireStaleBookingCheckouts(tenantId?: string) {
  await prisma.publicBookingCheckout.updateMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
}

export async function getDayOccupancy(
  tenantId: string,
  scheduledAt: Date,
  settings: {
    openTime: string;
    closeTime: string;
    workingDays: string;
  }
) {
  const dayStart = startOfDay(scheduledAt);
  const dayEnd = endOfDay(scheduledAt);

  await expireStaleBookingCheckouts(tenantId);

  const [appointments, pendingCheckouts, barbers] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { not: "CANCELLED" },
      },
      select: { scheduledAt: true, duration: true, barberId: true },
    }),
    prisma.publicBookingCheckout.findMany({
      where: {
        tenantId,
        status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
        expiresAt: { gt: new Date() },
      },
      select: { scheduledAt: true, serviceId: true, barberId: true },
    }),
    prisma.user.findMany({
      where: { tenantId, role: "BARBER", active: true },
      select: { id: true },
    }),
  ]);

  const serviceIds = [...new Set(pendingCheckouts.map((c) => c.serviceId))];
  const services =
    serviceIds.length > 0
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, duration: true },
        })
      : [];
  const serviceDurationMap = new Map(services.map((s) => [s.id, s.duration]));

  const checkoutBlocks = pendingCheckouts.map((checkout) => ({
    scheduledAt: checkout.scheduledAt,
    duration: serviceDurationMap.get(checkout.serviceId) ?? 30,
    barberId: checkout.barberId,
  }));

  return {
    appointments: [...appointments, ...checkoutBlocks],
    barbers,
  };
}

export async function validatePublicBookingSlot(options: {
  tenantId: string;
  serviceId: string;
  barberId?: string | null;
  scheduledAt: Date;
  settings: {
    openTime: string;
    closeTime: string;
    workingDays: string;
  };
}) {
  const service = await prisma.service.findFirst({
    where: { id: options.serviceId, tenantId: options.tenantId, active: true },
  });
  if (!service) throw new Error("Serviço inválido");

  const { appointments, barbers } = await getDayOccupancy(
    options.tenantId,
    options.scheduledAt,
    options.settings
  );

  const slots = getAvailableSlots({
    date: options.scheduledAt,
    openTime: options.settings.openTime,
    closeTime: options.settings.closeTime,
    workingDays: options.settings.workingDays,
    serviceDuration: service.duration,
    appointments,
    barberId: options.barberId || null,
    barberIds: barbers.map((b) => b.id),
  });

  const slotMatch = slots.some(
    (s) => new Date(s).getTime() === options.scheduledAt.getTime()
  );
  if (!slotMatch) throw new Error("Horário não disponível. Escolha outro.");

  return { service, barbers, dayAppointments: appointments };
}

export async function resolveBarberId(options: {
  tenantId: string;
  barberId?: string | null;
  scheduledAt: Date;
  serviceDuration: number;
  dayAppointments: Array<{ scheduledAt: Date; duration: number; barberId: string | null }>;
  barbers: Array<{ id: string }>;
}) {
  let barberId = options.barberId || null;
  if (!barberId && options.barbers.length > 0) {
    const freeBarber = options.barbers.find((b) => {
      const barberApts = options.dayAppointments.filter((a) => a.barberId === b.id);
      return !barberApts.some((apt) => {
        const aptEnd = new Date(apt.scheduledAt.getTime() + apt.duration * 60000);
        const slotEnd = new Date(
          options.scheduledAt.getTime() + options.serviceDuration * 60000
        );
        return options.scheduledAt < aptEnd && slotEnd > apt.scheduledAt;
      });
    });
    barberId = freeBarber?.id ?? null;
  }
  return barberId;
}

export function buildBookingPixPayload(options: {
  pixKey: string;
  holderName: string;
  city: string;
  amount: number;
  checkoutId: string;
}) {
  const copiaECola = generatePixCopiaECola({
    pixKey: options.pixKey,
    merchantName: options.holderName,
    merchantCity: options.city,
    amount: options.amount,
    txId: options.checkoutId.slice(-20),
  });

  return { copiaECola, pixKey: options.pixKey, holderName: options.holderName };
}

export async function createMercadoPagoBookingPayment(options: {
  accessToken: string;
  checkoutId: string;
  amount: number;
  description: string;
  clientPhone: string;
}) {
  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const payerEmail = `${options.clientPhone.replace(/\D/g, "").slice(-11)}@agendamento.cortecerto.app`;

  return createMercadoPagoPixPayment({
    accessToken: options.accessToken,
    amount: options.amount,
    description: options.description,
    externalReference: `bk_${options.checkoutId}`,
    payerEmail,
    notificationUrl: `${baseUrl}/api/webhooks/mercadopago`,
  });
}

export async function tryConfirmBookingViaMercadoPago(checkoutId: string) {
  const checkout = await prisma.publicBookingCheckout.findUnique({
    where: { id: checkoutId },
    include: { tenant: { include: { settings: true } } },
  });
  if (!checkout || checkout.status === "PAID" || checkout.status === "EXPIRED") {
    return checkout;
  }
  if (!checkout.mercadoPagoPaymentId) return checkout;

  const token = getBookingMercadoPagoToken(checkout.tenant.settings?.mercadoPagoAccessToken);
  if (!token) return checkout;

  const payment = await fetchMercadoPagoPayment(checkout.mercadoPagoPaymentId, token);
  if (payment?.status !== "approved") return checkout;

  return checkout;
}

export function getCheckoutExpiryDate() {
  return addMinutes(new Date(), CHECKOUT_HOLD_MINUTES);
}

export function isCheckoutExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now();
}

export async function markCheckoutExpired(checkoutId: string) {
  await prisma.publicBookingCheckout.updateMany({
    where: {
      id: checkoutId,
      status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] },
    },
    data: { status: "EXPIRED" },
  });
}

export { CHECKOUT_HOLD_MINUTES };
