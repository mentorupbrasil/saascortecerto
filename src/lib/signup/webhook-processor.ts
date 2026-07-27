import "server-only";

import { prisma } from "@/lib/prisma";
import { provisionTenantFromCheckout } from "@/lib/signup/provision";

export async function processMercadoPagoWebhookPayment(paymentId: string) {
  const { fetchMercadoPagoPayment } = await import("@/lib/mercadopago");
  const { processBookingMercadoPagoPayment } = await import("@/lib/public-booking-actions");

  const bookingAppointmentId = await processBookingMercadoPagoPayment(paymentId);
  if (bookingAppointmentId) return bookingAppointmentId;

  const payment = await fetchMercadoPagoPayment(paymentId);
  if (!payment?.external_reference) return null;
  if (payment.external_reference.startsWith("bk_")) return null;
  if (payment.status !== "approved") return null;

  const checkoutId = payment.external_reference;
  await prisma.signupCheckout.update({
    where: { id: checkoutId },
    data: { mercadoPagoPaymentId: String(payment.id) },
  });

  const tenantId = await provisionTenantFromCheckout(checkoutId);
  return tenantId;
}
