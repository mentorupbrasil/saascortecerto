/**
 * Rate limiting — Upstash-ready interface with in-memory fallback for dev.
 *
 * Production: swap `InMemoryRateLimiter` for `@upstash/ratelimit` + Redis.
 * Example:
 *   import { Ratelimit } from "@upstash/ratelimit";
 *   import { Redis } from "@upstash/redis";
 *   const limiter = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, "1 m") });
 */

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

type Bucket = { count: number; resetAt: number };

class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return {
        success: true,
        limit: this.limit,
        remaining: this.limit - 1,
        resetAt,
      };
    }

    if (existing.count >= this.limit) {
      return {
        success: false,
        limit: this.limit,
        remaining: 0,
        resetAt: existing.resetAt,
      };
    }

    existing.count += 1;
    return {
      success: true,
      limit: this.limit,
      remaining: this.limit - existing.count,
      resetAt: existing.resetAt,
    };
  }
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * Default limiter: 60 requests per minute per key.
 * In production, replace with Upstash Redis for durable cross-instance limits.
 */
export function createRateLimiter(options?: {
  limit?: number;
  windowMs?: number;
}): RateLimiter {
  const limit = options?.limit ?? 60;
  const windowMs = options?.windowMs ?? 60_000;

  if (isProduction) {
    // TODO: wire Upstash when UPSTASH_REDIS_REST_URL is configured
    console.warn(
      "[rate-limit] Using in-memory limiter in production — configure Upstash for durable limits."
    );
  }

  return new InMemoryRateLimiter(limit, windowMs);
}

export const defaultRateLimiter = createRateLimiter();

export async function rateLimitOrThrow(
  key: string,
  limiter: RateLimiter = defaultRateLimiter
): Promise<RateLimitResult> {
  const result = await limiter.check(key);
  if (!result.success) {
    throw new Error("Too many requests");
  }
  return result;
}
