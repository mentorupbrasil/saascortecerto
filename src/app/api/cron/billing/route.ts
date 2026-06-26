import { NextRequest, NextResponse } from "next/server";
import { runBillingCron } from "@/lib/billing-actions";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBillingCron();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
