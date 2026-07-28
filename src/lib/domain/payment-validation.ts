import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";

export type MercadoPagoPaymentFields = {
  status: string;
  currency_id: string;
  transaction_amount: number;
  external_reference: string;
  id: number | string;
};

export type PaymentValidationErrorReason =
  | "status_not_approved"
  | "currency_mismatch"
  | "amount_mismatch"
  | "external_reference_mismatch";

export type PaymentValidationResult =
  | { ok: true }
  | { ok: false; reason: PaymentValidationErrorReason };

export function validateApprovedMercadoPagoPayment(options: {
  payment: MercadoPagoPaymentFields;
  expected: {
    externalReference: string;
    amountDecimalOrString: number | string | Decimal;
    currency: "BRL";
  };
}): PaymentValidationResult {
  const { payment, expected } = options;

  if (payment.status !== "approved") {
    return { ok: false, reason: "status_not_approved" };
  }

  if (payment.currency_id !== "BRL") {
    return { ok: false, reason: "currency_mismatch" };
  }

  const expectedAmount = new Decimal(expected.amountDecimalOrString).toFixed(2);
  const actualAmount = new Decimal(payment.transaction_amount).toFixed(2);
  if (expectedAmount !== actualAmount) {
    return { ok: false, reason: "amount_mismatch" };
  }

  if (payment.external_reference !== expected.externalReference) {
    return { ok: false, reason: "external_reference_mismatch" };
  }

  return { ok: true };
}

export type PaymentIdAvailabilityResult =
  | { ok: true }
  | { ok: false; reason: "payment_id_already_used" };

export async function assertMercadoPagoPaymentIdAvailable(
  paymentId: string | number,
  owner: { kind: "signup"; checkoutId: string } | { kind: "booking"; checkoutId: string }
): Promise<PaymentIdAvailabilityResult> {
  const id = String(paymentId);

  const [signupHit, bookingHit] = await Promise.all([
    prisma.signupCheckout.findFirst({
      where: { mercadoPagoPaymentId: id },
      select: { id: true },
    }),
    prisma.publicBookingCheckout.findFirst({
      where: { mercadoPagoPaymentId: id },
      select: { id: true },
    }),
  ]);

  if (signupHit && !(owner.kind === "signup" && signupHit.id === owner.checkoutId)) {
    return { ok: false, reason: "payment_id_already_used" };
  }

  if (bookingHit && !(owner.kind === "booking" && bookingHit.id === owner.checkoutId)) {
    return { ok: false, reason: "payment_id_already_used" };
  }

  return { ok: true };
}
