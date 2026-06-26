import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const checks: Record<string, string> = {
    database: "unknown",
    users: "unknown",
  };

  try {
    if (!process.env.DATABASE_URL) {
      checks.database = "missing DATABASE_URL";
      return NextResponse.json({ ok: false, checks }, { status: 500 });
    }

    if (!process.env.NEXTAUTH_SECRET) {
      checks.auth = "missing NEXTAUTH_SECRET";
    }

    await prisma.$queryRaw`SELECT 1`;
    checks.database = "connected";

    const userCount = await prisma.user.count();
    checks.users = userCount > 0 ? `${userCount} users` : "empty — run db:seed";

    return NextResponse.json({
      ok: true,
      checks,
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
        nodeEnv: process.env.NODE_ENV,
      },
    });
  } catch (err) {
    checks.database = err instanceof Error ? err.message : "connection failed";
    return NextResponse.json({ ok: false, checks }, { status: 500 });
  }
}
