import { NextRequest, NextResponse } from "next/server";
import { processMercadoPagoWebhookPayment } from "@/lib/signup-actions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paymentId =
      body?.data?.id ??
      body?.id ??
      new URL(req.url).searchParams.get("id") ??
      new URL(req.url).searchParams.get("data.id");

    if (!paymentId) {
      return NextResponse.json({ ok: true, skipped: "no payment id" });
    }

    const tenantId = await processMercadoPagoWebhookPayment(String(paymentId));
    return NextResponse.json({ ok: true, tenantId });
  } catch (err) {
    console.error("Mercado Pago webhook error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const paymentId = new URL(req.url).searchParams.get("id");
  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

  try {
    const tenantId = await processMercadoPagoWebhookPayment(paymentId);
    return NextResponse.json({ ok: true, tenantId });
  } catch (err) {
    console.error("Mercado Pago webhook GET error:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
