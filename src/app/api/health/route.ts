import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logging/logger";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
};

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE_HEADERS });
  } catch {
    logger.error("health_check_failed", {
      message: "Database health check failed",
    });
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE_HEADERS });
  }
}
