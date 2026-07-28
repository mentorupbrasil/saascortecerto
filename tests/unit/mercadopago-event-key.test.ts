import { describe, expect, it } from "vitest";
import {
  buildMercadoPagoEventKey,
  hashWebhookPayload,
} from "@/lib/integrations/mercadopago-webhook";

describe("buildMercadoPagoEventKey", () => {
  it("prefers notificationId when present", () => {
    const key = buildMercadoPagoEventKey({
      notificationId: "12345",
      type: "payment",
      action: "payment.updated",
      paymentId: "999",
      payloadHash: "abc",
    });
    expect(key).toBe("mercadopago:payment:12345");
  });

  it("trims notificationId whitespace", () => {
    const key = buildMercadoPagoEventKey({
      notificationId: "  notif-99  ",
      type: "payment",
      action: "payment.updated",
      paymentId: "999",
      payloadHash: "abc",
    });
    expect(key).toBe("mercadopago:payment:notif-99");
  });

  it("falls back to action+paymentId+payloadHash when notificationId is absent", () => {
    const rawBody = JSON.stringify({ action: "payment.created", data: { id: "42" } });
    const payloadHash = hashWebhookPayload(rawBody);
    const key = buildMercadoPagoEventKey({
      notificationId: null,
      type: "payment",
      action: "payment.created",
      paymentId: "42",
      payloadHash,
    });
    expect(key).toBe(`mercadopago:payment:payment.created:42:${payloadHash}`);
  });

  it("treats empty notificationId as absent", () => {
    const key = buildMercadoPagoEventKey({
      notificationId: "   ",
      type: "payment",
      action: "payment.updated",
      paymentId: "77",
      payloadHash: "deadbeef",
    });
    expect(key).toBe("mercadopago:payment:payment.updated:77:deadbeef");
  });

  it("different payload hashes produce different fallback keys for same payment", () => {
    const keyA = buildMercadoPagoEventKey({
      notificationId: null,
      type: "payment",
      action: "payment.updated",
      paymentId: "100",
      payloadHash: hashWebhookPayload('{"status":"pending"}'),
    });
    const keyB = buildMercadoPagoEventKey({
      notificationId: null,
      type: "payment",
      action: "payment.updated",
      paymentId: "100",
      payloadHash: hashWebhookPayload('{"status":"approved"}'),
    });
    expect(keyA).not.toBe(keyB);
  });
});
