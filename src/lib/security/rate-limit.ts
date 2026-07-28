/**
 * Persistent rate limiting backed by PostgreSQL (RateLimitBucket).
 *
 * Identities (IP, phone, email, etc.) are never stored in plaintext — only
 * an HMAC-SHA256 hash of the normalized identity, keyed by a server secret.
 * Fixed-window counters: one row per (scope, identity hash, window start).
 */
import "server-only";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

export const RATE_LIMIT_MESSAGE =
  "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

export class RateLimitError extends Error {
  constructor(message: string = RATE_LIMIT_MESSAGE) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** Only used outside production when neither RATE_LIMIT_SECRET nor NEXTAUTH_SECRET is set (local dev/tests). */
const DEV_FALLBACK_SECRET = "dev-only-insecure-rate-limit-secret-do-not-use-in-production";

function resolveSecret(): string {
  const explicit = process.env.RATE_LIMIT_SECRET?.trim();
  if (explicit) return explicit;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Configuração de segurança ausente. Tente novamente mais tarde."
    );
  }

  const authSecret = process.env.NEXTAUTH_SECRET?.trim();
  return authSecret || DEV_FALLBACK_SECRET;
}

function hashIdentity(identityParts: Array<string | null | undefined>): string {
  const secret = resolveSecret();
  const normalized = identityParts
    .map((part) => (part ?? "").trim().toLowerCase())
    .join("|");
  return createHmac("sha256", secret).update(normalized).digest("hex");
}

export type ConsumeRateLimitInput = {
  /** Logical bucket, e.g. "login", "signup", "public_booking_create" */
  scope: string;
  /** Parts combined and hashed to form the rate-limit identity (never stored raw) */
  identityParts: Array<string | null | undefined>;
  limit: number;
  windowMs: number;
};

/**
 * Increments the counter for this (scope, identity, window) and throws
 * RateLimitError once the limit is exceeded within the current fixed
 * window. Safe under concurrency: the increment is a single atomic
 * upsert backed by the bucket's unique constraint.
 */
export async function consumeRateLimit(input: ConsumeRateLimitInput): Promise<void> {
  const keyHash = hashIdentity(input.identityParts);
  const windowStart = new Date(
    Math.floor(Date.now() / input.windowMs) * input.windowMs
  );
  const expiresAt = new Date(windowStart.getTime() + input.windowMs);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: {
      scope_keyHash_windowStart: {
        scope: input.scope,
        keyHash,
        windowStart,
      },
    },
    create: {
      scope: input.scope,
      keyHash,
      windowStart,
      count: 1,
      expiresAt,
    },
    update: { count: { increment: 1 } },
  });

  // Opportunistic cleanup — no dedicated cron for this low-stakes table.
  if (Math.random() < 0.01) {
    cleanupExpiredRateLimits().catch(() => {});
  }

  if (bucket.count > input.limit) {
    throw new RateLimitError();
  }
}

/** Deletes expired buckets. Safe to call from a cron job or ad hoc. */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const result = await prisma.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
