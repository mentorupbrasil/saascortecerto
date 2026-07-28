import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyMercadoPagoSignature } from "@/lib/integrations/mercadopago-webhook";

const SECRET = "test-webhook-secret";
const DATA_ID = "123456789";
const REQUEST_ID = "req-abc-123";
const TS = "1700000000";

function buildManifest(dataId: string, xRequestId: string | null, ts: string): string {
  const normalizedId = /[A-Z]/.test(dataId) ? dataId.toLowerCase() : dataId;
  const parts: string[] = [];
  if (normalizedId) parts.push(`id:${normalizedId}`);
  if (xRequestId) parts.push(`request-id:${xRequestId}`);
  parts.push(`ts:${ts}`);
  return `${parts.join(";")};`;
}

/** Independent test oracle — not the implementation under test. */
function computeExpectedV1(options: {
  dataId: string;
  xRequestId: string | null;
  ts: string;
  secret: string;
}): string {
  const manifest = buildManifest(options.dataId, options.xRequestId, options.ts);
  return createHmac("sha256", options.secret).update(manifest).digest("hex");
}

describe("verifyMercadoPagoSignature", () => {
  it("accepts a valid signature", () => {
    const v1 = computeExpectedV1({
      dataId: DATA_ID,
      xRequestId: REQUEST_ID,
      ts: TS,
      secret: SECRET,
    });
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${TS},v1=${v1}`,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts uppercase data.id by lowercasing in manifest", () => {
    const dataId = "ABC123def";
    const v1 = computeExpectedV1({
      dataId,
      xRequestId: REQUEST_ID,
      ts: TS,
      secret: SECRET,
    });
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${TS},v1=${v1}`,
      xRequestId: REQUEST_ID,
      dataId,
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing secret", () => {
    const v1 = computeExpectedV1({
      dataId: DATA_ID,
      xRequestId: REQUEST_ID,
      ts: TS,
      secret: SECRET,
    });
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${TS},v1=${v1}`,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      secret: "",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("webhook_secret_missing");
  });

  it("rejects altered signature", () => {
    const v1 = computeExpectedV1({
      dataId: DATA_ID,
      xRequestId: REQUEST_ID,
      ts: TS,
      secret: SECRET,
    });
    const altered = `${v1.slice(0, -1)}${v1.endsWith("a") ? "b" : "a"}`;
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${TS},v1=${altered}`,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("signature_mismatch");
  });

  it("rejects wrong secret", () => {
    const v1 = computeExpectedV1({
      dataId: DATA_ID,
      xRequestId: REQUEST_ID,
      ts: TS,
      secret: SECRET,
    });
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${TS},v1=${v1}`,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      secret: "other-secret",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("signature_mismatch");
  });

  it("accepts missing request id when manifest omits request-id pair", () => {
    const v1 = computeExpectedV1({
      dataId: DATA_ID,
      xRequestId: null,
      ts: TS,
      secret: SECRET,
    });
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${TS},v1=${v1}`,
      xRequestId: null,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing ts", () => {
    const v1 = computeExpectedV1({
      dataId: DATA_ID,
      xRequestId: REQUEST_ID,
      ts: TS,
      secret: SECRET,
    });
    const result = verifyMercadoPagoSignature({
      xSignature: `v1=${v1}`,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("signature_format_invalid");
  });

  it("parses multiple comma-separated parts in x-signature", () => {
    const v1 = computeExpectedV1({
      dataId: DATA_ID,
      xRequestId: REQUEST_ID,
      ts: TS,
      secret: SECRET,
    });
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${TS},v1=${v1},ignored=extra`,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects different-length v1 without throwing", () => {
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${TS},v1=abc`,
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
