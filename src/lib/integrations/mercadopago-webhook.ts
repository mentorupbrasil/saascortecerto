import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logging/logger";

/**
 * Mercado Pago webhook signature validation (x-signature + x-request-id).
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * Expected x-signature: ts=...,v1=...
 * Manifest: `id:[data.id];request-id:[x-request-id];ts:[ts];`
 */
export function verifyMercadoPagoSignature(options: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}): { ok: boolean; reason?: string } {
  const { xSignature, xRequestId, dataId, secret } = options;
  if (!secret) return { ok: false, reason: "webhook_secret_missing" };
  if (!xSignature) return { ok: false, reason: "signature_missing" };
  if (!xRequestId) return { ok: false, reason: "request_id_missing" };

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), (v ?? "").trim()];
    })
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return { ok: false, reason: "signature_format_invalid" };

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const computed = createHash("sha256")
    .update(manifest + secret)
    .digest("hex");

  try {
    const a = Buffer.from(computed, "utf8");
    const b = Buffer.from(v1, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "signature_mismatch" };
    }
  } catch {
    return { ok: false, reason: "signature_compare_error" };
  }

  return { ok: true };
}

export async function claimWebhookEvent(options: {
  provider: string;
  eventKey: string;
  payloadHash?: string;
}): Promise<"claimed" | "duplicate"> {
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        provider: options.provider,
        eventKey: options.eventKey,
        payloadHash: options.payloadHash ?? null,
        result: "processing",
      },
    });
    return "claimed";
  } catch {
    return "duplicate";
  }
}

export async function completeWebhookEvent(
  provider: string,
  eventKey: string,
  result: string
) {
  await prisma.processedWebhookEvent.updateMany({
    where: { provider, eventKey },
    data: { result, processedAt: new Date() },
  });
  logger.info("webhook_processed", {
    action: "webhook.processed",
    entity: provider,
    entityId: eventKey,
    result: "success",
  });
}
