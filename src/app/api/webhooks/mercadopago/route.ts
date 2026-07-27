import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { processMercadoPagoWebhookPayment } from "@/lib/signup/webhook-processor";
import {
  claimWebhookEvent,
  completeWebhookEvent,
  verifyMercadoPagoSignature,
} from "@/lib/integrations/mercadopago-webhook";
import { logger, createRequestId } from "@/lib/logging/logger";

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  try {
    const rawBody = await req.text();
    let body: Record<string, unknown> = {};
    try {
      body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const data = body.data as { id?: string | number } | undefined;
    const paymentId = String(
      data?.id ?? body.id ?? new URL(req.url).searchParams.get("data.id") ?? ""
    );

    if (!paymentId) {
      return NextResponse.json({ ok: true, skipped: "no payment id" });
    }

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? "";
    const xSignature = req.headers.get("x-signature");
    const xRequestId = req.headers.get("x-request-id");

    // In production, secret is mandatory. In development, allow without if unset.
    if (process.env.NODE_ENV === "production" || secret) {
      const verified = verifyMercadoPagoSignature({
        xSignature,
        xRequestId,
        dataId: paymentId,
        secret,
      });
      if (!verified.ok) {
        logger.warn("webhook_signature_rejected", {
          requestId,
          action: "webhook.mercadopago",
          errorCode: verified.reason,
          result: "failure",
        });
        return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
      }
    }

    const eventKey = `payment:${paymentId}:${xRequestId ?? "no-req"}`;
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const claim = await claimWebhookEvent({
      provider: "mercadopago",
      eventKey,
      payloadHash,
    });
    if (claim === "duplicate") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const tenantId = await processMercadoPagoWebhookPayment(paymentId);
    await completeWebhookEvent("mercadopago", eventKey, tenantId ? "ok" : "skipped");

    return NextResponse.json({ ok: true, tenantId });
  } catch (err) {
    logger.error("webhook_mercadopago_error", {
      requestId,
      action: "webhook.mercadopago",
      result: "failure",
      errorCode: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }
}

/** Health/verification only — never mutate state on GET */
export async function GET() {
  return NextResponse.json({ ok: true, method: "GET", mutate: false });
}
