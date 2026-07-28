import "server-only";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logging/logger";

export const WEBHOOK_LEASE_MS = 10 * 60 * 1000;

/**
 * Mercado Pago webhook signature validation (x-signature + x-request-id).
 * Official: HMAC-SHA256(secret, manifest)
 * Manifest: `id:[data.id];request-id:[x-request-id];ts:[ts];` (omit missing pairs)
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

export function buildMercadoPagoManifest(
  dataId: string,
  xRequestId: string | null,
  ts: string
): string {
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

  const manifest = buildMercadoPagoManifest(dataId, xRequestId, ts);
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");

  if (!safeCompareHex(computed, v1)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true };
}

export function buildMercadoPagoEventKey(options: {
  notificationId?: string | null;
  type: string;
  action: string;
  paymentId: string;
  payloadHash: string;
}): string {
  const notificationId = options.notificationId?.trim();
  if (notificationId) {
    return `mercadopago:${options.type}:${notificationId}`;
  }
  return `mercadopago:${options.type}:${options.action}:${options.paymentId}:${options.payloadHash}`;
}

export function hashWebhookPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function sanitizeWebhookError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/APP_USR-\S+/gi, "[REDACTED_TOKEN]")
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/\b\d{10,13}\b/g, "[REDACTED_PHONE]")
    .slice(0, 500);
}

function isUniqueConstraintError(
  err: unknown
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function claimWebhookEvent(options: {
  provider: string;
  eventKey: string;
  payloadHash?: string;
  now?: Date;
}): Promise<"claimed" | "duplicate"> {
  const now = options.now ?? new Date();
  const leaseCutoff = new Date(now.getTime() - WEBHOOK_LEASE_MS);

  try {
    await prisma.processedWebhookEvent.create({
      data: {
        provider: options.provider,
        eventKey: options.eventKey,
        payloadHash: options.payloadHash ?? null,
        status: "PROCESSING",
        attemptCount: 1,
        lockedAt: now,
        processedAt: null,
        lastError: null,
      },
    });
    return "claimed";
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
  }

  // Conditional reclaim: FAILED anytime, or PROCESSING with expired lease
  const reclaimed = await prisma.processedWebhookEvent.updateMany({
    where: {
      provider: options.provider,
      eventKey: options.eventKey,
      OR: [
        { status: "FAILED" },
        { status: "PROCESSING", lockedAt: { lt: leaseCutoff } },
      ],
    },
    data: {
      status: "PROCESSING",
      lockedAt: now,
      processedAt: null,
      lastError: null,
      payloadHash: options.payloadHash ?? null,
      attemptCount: { increment: 1 },
    },
  });

  if (reclaimed.count === 1) return "claimed";
  return "duplicate";
}

export async function completeWebhookEvent(
  provider: string,
  eventKey: string,
  result: string
) {
  await prisma.processedWebhookEvent.updateMany({
    where: { provider, eventKey, status: "PROCESSING" },
    data: {
      status: "PROCESSED",
      result,
      processedAt: new Date(),
      lastError: null,
    },
  });
  logger.info("webhook_processed", {
    action: "webhook.processed",
    entity: provider,
    entityId: eventKey,
    result: "success",
  });
}

export async function failWebhookEvent(
  provider: string,
  eventKey: string,
  error: unknown
) {
  const lastError = sanitizeWebhookError(error);
  await prisma.processedWebhookEvent.updateMany({
    where: { provider, eventKey, status: "PROCESSING" },
    data: {
      status: "FAILED",
      result: "failed",
      processedAt: new Date(),
      lastError,
    },
  });
  logger.warn("webhook_failed", {
    action: "webhook.failed",
    entity: provider,
    entityId: eventKey,
    result: "failure",
    errorCode: lastError,
  });
}
