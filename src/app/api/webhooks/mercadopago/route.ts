import { NextRequest, NextResponse } from "next/server";
import { processMercadoPagoWebhookPayment } from "@/lib/signup/webhook-processor";
import {
  buildMercadoPagoEventKey,
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  hashWebhookPayload,
  verifyMercadoPagoSignature,
} from "@/lib/integrations/mercadopago-webhook";
import { logger, createRequestId } from "@/lib/logging/logger";

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  let eventKey: string | null = null;

  try {
    const rawBody = await req.text();
    let body: Record<string, unknown> = {};
    try {
      body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const searchParams = new URL(req.url).searchParams;
    const data = body.data as { id?: string | number } | undefined;

    // Official signature uses query data.id; body is fallback
    const signatureDataId =
      searchParams.get("data.id") || String(data?.id ?? "");

    const paymentId = String(data?.id ?? searchParams.get("data.id") ?? "");
    if (!paymentId) {
      return NextResponse.json({ ok: true, skipped: "no payment id" });
    }

    const action = String(body.action ?? "unknown");
    const type = String(body.type ?? "payment");
    const notificationId = body.id != null ? String(body.id) : null;
    const payloadHash = hashWebhookPayload(rawBody);

    eventKey = buildMercadoPagoEventKey({
      notificationId,
      type,
      action,
      paymentId,
      payloadHash,
    });

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? "";
    const xSignature = req.headers.get("x-signature");
    const xRequestId = req.headers.get("x-request-id");

    if (process.env.NODE_ENV === "production" || secret) {
      const verified = verifyMercadoPagoSignature({
        xSignature,
        xRequestId,
        dataId: signatureDataId,
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
    if (eventKey) {
      await failWebhookEvent("mercadopago", eventKey, err);
    }

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
