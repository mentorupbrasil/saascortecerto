import { NextRequest, NextResponse } from "next/server";
import { runAutoReturnCron } from "@/lib/whatsapp-actions";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runAutoReturnCron();
  return NextResponse.json({ ok: true, results, at: new Date().toISOString() });
}
