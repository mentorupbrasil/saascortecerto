import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting. Reads standard proxy headers set
 * by Vercel / reverse proxies. Falls back to "unknown" outside request scope
 * (e.g. background jobs) or when no proxy header is present — callers should
 * still combine this with another identity part (email/phone) for limits.
 */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwardedFor = h.get("x-forwarded-for");
    if (forwardedFor) {
      const first = forwardedFor.split(",")[0]?.trim();
      if (first) return first;
    }
    const realIp = h.get("x-real-ip");
    if (realIp) return realIp.trim();
  } catch {
    // headers() is only available inside a request scope
  }
  return "unknown";
}
