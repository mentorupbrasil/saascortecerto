import "server-only";

import { prisma } from "@/lib/prisma";
import { provisionTenantFromCheckout } from "@/lib/signup/provision";
import {
  assertMercadoPagoPaymentIdAvailable,
  validateApprovedMercadoPagoPayment,
} from "@/lib/domain/payment-validation";
import { logger } from "@/lib/logging/logger";

export async function processMercadoPagoWebhookPayment(paymentId: string) {
  const { fetchMercadoPagoPayment } = await import("@/lib/mercadopago");
  const { processBookingMercadoPagoPayment } = await import("@/lib/public-booking-actions");

  const bookingAppointmentId = await processBookingMercadoPagoPayment(paymentId);
  if (bookingAppointmentId) return bookingAppointmentId;

  const payment = await fetchMercadoPagoPayment(paymentId);
  if (!payment?.external_reference) return null;
  if (payment.external_reference.startsWith("bk_")) return null;

  const checkoutId = payment.external_reference;
  const checkout = await prisma.signupCheckout.findUnique({ where: { id: checkoutId } });
  if (!checkout) return null;

  const validation = validateApprovedMercadoPagoPayment({
    payment: {
      status: payment.status,
      currency_id: payment.currency_id,
      transaction_amount: payment.transaction_amount,
      external_reference: payment.external_reference,
      id: payment.id,
    },
    expected: {
      externalReference: checkout.id,
      amountDecimalOrString: checkout.amount,
      currency: "BRL",
    },
  });

  if (!validation.ok) {
    logger.warn("signup_payment_validation_failed", {
      action: "webhook.signup.payment_validation",
      checkoutId,
      paymentId,
      reason: validation.reason,
    });
    return null;
  }

  const paymentAvailability = await assertMercadoPagoPaymentIdAvailable(payment.id, {
    kind: "signup",
    checkoutId: checkout.id,
  });
  if (!paymentAvailability.ok) {
    logger.warn("signup_payment_id_conflict", {
      action: "webhook.signup.payment_id_conflict",
      checkoutId,
      paymentId,
    });
    return null;
  }

  await prisma.signupCheckout.update({
    where: { id: checkoutId },
    data: { mercadoPagoPaymentId: String(payment.id) },
  });

  const tenantId = await provisionTenantFromCheckout(checkoutId);
  return tenantId;
}
