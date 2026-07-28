import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";
import { validateApprovedMercadoPagoPayment } from "@/lib/domain/payment-validation";

const basePayment = {
  status: "approved" as const,
  currency_id: "BRL" as const,
  transaction_amount: 49.9,
  external_reference: "checkout_abc",
  id: 12345,
};

const baseExpected = {
  externalReference: "checkout_abc",
  amountDecimalOrString: "49.90",
  currency: "BRL" as const,
};

describe("validateApprovedMercadoPagoPayment", () => {
  it("accepts a valid approved BRL payment", () => {
    const result = validateApprovedMercadoPagoPayment({
      payment: basePayment,
      expected: baseExpected,
    });
    expect(result.ok).toBe(true);
  });

  it("compares amounts with Decimal precision (no float drift)", () => {
    const result = validateApprovedMercadoPagoPayment({
      payment: { ...basePayment, transaction_amount: 49.899999999 },
      expected: { ...baseExpected, amountDecimalOrString: new Decimal("49.90") },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects non-approved status", () => {
    const result = validateApprovedMercadoPagoPayment({
      payment: { ...basePayment, status: "pending" },
      expected: baseExpected,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("status_not_approved");
  });

  it("rejects non-BRL currency", () => {
    const result = validateApprovedMercadoPagoPayment({
      payment: { ...basePayment, currency_id: "USD" },
      expected: baseExpected,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("currency_mismatch");
  });

  it("rejects amount mismatch", () => {
    const result = validateApprovedMercadoPagoPayment({
      payment: { ...basePayment, transaction_amount: 50 },
      expected: baseExpected,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("amount_mismatch");
  });

  it("rejects external reference mismatch", () => {
    const result = validateApprovedMercadoPagoPayment({
      payment: { ...basePayment, external_reference: "other_checkout" },
      expected: baseExpected,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("external_reference_mismatch");
  });
});
