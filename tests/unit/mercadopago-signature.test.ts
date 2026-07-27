import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyMercadoPagoSignature } from "@/lib/integrations/mercadopago-webhook";

const SECRET = "test-webhook-secret";
const DATA_ID = "123456789";
const REQUEST_ID = "req-abc-123";
const TS = "1700000000";

function buildValidSignature() {
  const manifest = `id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`;
  const v1 = createHash("sha256").update(manifest + SECRET).digest("hex");
  return { xSignature: `ts=${TS},v1=${v1}`, xRequestId: REQUEST_ID };
}

describe("verifyMercadoPagoSignature", () => {
  it("accepts a valid signature", () => {
    const { xSignature, xRequestId } = buildValidSignature();
    const result = verifyMercadoPagoSignature({
      xSignature,
      xRequestId,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing secret", () => {
    const { xSignature, xRequestId } = buildValidSignature();
    const result = verifyMercadoPagoSignature({
      xSignature,
      xRequestId,
      dataId: DATA_ID,
      secret: "",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("webhook_secret_missing");
  });

  it("rejects invalid signature", () => {
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${TS},v1=deadbeef`,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("signature_mismatch");
  });

  it("rejects missing x-signature header", () => {
    const result = verifyMercadoPagoSignature({
      xSignature: null,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("signature_missing");
  });
});
