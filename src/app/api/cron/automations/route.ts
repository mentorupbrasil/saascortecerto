import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AuthError, requireCronSecret } from "@/lib/authz";
import { processPendingDomainEvents } from "@/lib/automation/dispatcher";
import { processMessageOutbox } from "@/lib/whatsapp/outbox";
import { logger, createRequestId } from "@/lib/logging/logger";

export async function GET(req: NextRequest) {
  const requestId = createRequestId();
  try {
    requireCronSecret(req.headers.get("authorization"));
    const events = await processPendingDomainEvents();
    const outbox = await processMessageOutbox();
    logger.info("automations_cron_ok", {
      requestId,
      action: "cron.automations",
      result: "success",
    });
    return NextResponse.json({ ok: true, events, outbox });
  } catch (err) {
    const isAuth = err instanceof AuthError;
    logger.error("automations_cron_failed", {
      requestId,
      action: "cron.automations",
      result: "failure",
      errorCode: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "cron_failed" },
      { status: isAuth ? 401 : 500 }
    );
  }
}
