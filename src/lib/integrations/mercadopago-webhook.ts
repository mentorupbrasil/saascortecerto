import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logging/logger";

/**
 * Mercado Pago webhook signature validation (x-signature + x-request-id).
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * Expected x-signature: ts=...,v1=...
 * Manifest: `id:[data.id];request-id:[x-request-id];ts:[ts];` (omit id/request-id pairs when missing)
 */
function parseXSignature(xSignature: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const segment of xSignature.split(",")) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const key = segment.slice(0, eq).trim();
    const value = segment.slice(eq + 1).trim();
    if (key) parts[key] = value;
  }
  return parts;
}

function normalizeDataIdForManifest(dataId: string): string {
  if (!dataId) return dataId;
  if (/[A-Z]/.test(dataId)) return dataId.toLowerCase();
  return dataId;
}

function buildManifest(dataId: string, xRequestId: string | null, ts: string): string {
  const parts: string[] = [];
  const normalizedId = normalizeDataIdForManifest(dataId);
  if (normalizedId) parts.push(`id:${normalizedId}`);
  if (xRequestId) parts.push(`request-id:${xRequestId}`);
  parts.push(`ts:${ts}`);
  return `${parts.join(";")};`;
}

function safeCompareHex(computed: string, provided: string): boolean {
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyMercadoPagoSignature(options: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}): { ok: boolean; reason?: string } {
  const { xSignature, xRequestId, dataId, secret } = options;
  if (!secret) return { ok: false, reason: "webhook_secret_missing" };
  if (!xSignature) return { ok: false, reason: "signature_missing" };

  const parts = parseXSignature(xSignature);
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return { ok: false, reason: "signature_format_invalid" };

  const manifest = buildManifest(dataId, xRequestId, ts);
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");

  if (!safeCompareHex(computed, v1)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true };
}

function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
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
        status: "PROCESSING",
      },
    });
    return "claimed";
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;

    const reclaimed = await prisma.processedWebhookEvent.updateMany({
      where: {
        provider: options.provider,
        eventKey: options.eventKey,
        status: "FAILED",
      },
      data: {
        status: "PROCESSING",
        result: null,
        payloadHash: options.payloadHash ?? null,
        processedAt: new Date(),
      },
    });

    if (reclaimed.count > 0) return "claimed";
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
    data: { status: "PROCESSED", result, processedAt: new Date() },
  });
  logger.info("webhook_processed", {
    action: "webhook.processed",
    entity: provider,
    entityId: eventKey,
    result: "success",
  });
}

export async function failWebhookEvent(provider: string, eventKey: string, result: string) {
  await prisma.processedWebhookEvent.updateMany({
    where: { provider, eventKey },
    data: { status: "FAILED", result, processedAt: new Date() },
  });
  logger.warn("webhook_failed", {
    action: "webhook.failed",
    entity: provider,
    entityId: eventKey,
    result: "failure",
    errorCode: result,
  });
}
