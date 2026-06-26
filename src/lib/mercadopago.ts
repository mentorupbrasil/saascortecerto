import "server-only";

export function getMercadoPagoAccessToken() {
  return process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || null;
}

export function isMercadoPagoConfigured() {
  return !!getMercadoPagoAccessToken();
}

export function isSignupDemoMode() {
  return process.env.SIGNUP_DEMO_MODE === "true";
}

export async function createMercadoPagoPreference(options: {
  checkoutId: string;
  planLabel: string;
  amount: number;
  ownerEmail: string;
}) {
  const token = getMercadoPagoAccessToken();
  if (!token) throw new Error("Mercado Pago não configurado");

  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          id: options.checkoutId,
          title: `CorteCerto — ${options.planLabel}`,
          description: "Assinatura mensal — 1ª cobrança",
          quantity: 1,
          currency_id: "BRL",
          unit_price: options.amount,
        },
      ],
      payer: { email: options.ownerEmail },
      external_reference: options.checkoutId,
      back_urls: {
        success: `${baseUrl}/assinar/sucesso?checkout=${options.checkoutId}`,
        failure: `${baseUrl}/assinar/${options.checkoutId}/pagamento?status=falha`,
        pending: `${baseUrl}/assinar/${options.checkoutId}/pagamento?status=pendente`,
      },
      auto_return: "approved",
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      statement_descriptor: "CORTECERTO",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? "Erro ao criar pagamento Mercado Pago");
  }

  return {
    preferenceId: data.id as string,
    initPoint: (data.init_point ?? data.sandbox_init_point) as string,
  };
}

export async function fetchMercadoPagoPayment(paymentId: string, accessToken?: string) {
  const token = accessToken ?? getMercadoPagoAccessToken();
  if (!token) return null;

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  return res.json() as Promise<{
    id: number;
    status: string;
    external_reference?: string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
      };
    };
  }>;
}

export async function createMercadoPagoPixPayment(options: {
  accessToken: string;
  amount: number;
  description: string;
  externalReference: string;
  payerEmail: string;
  notificationUrl: string;
}) {
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": options.externalReference,
    },
    body: JSON.stringify({
      transaction_amount: options.amount,
      description: options.description,
      payment_method_id: "pix",
      payer: { email: options.payerEmail },
      external_reference: options.externalReference,
      notification_url: options.notificationUrl,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? "Erro ao gerar PIX no Mercado Pago");
  }

  const txData = data.point_of_interaction?.transaction_data;

  return {
    paymentId: String(data.id),
    status: data.status as string,
    copiaECola: (txData?.qr_code as string | undefined) ?? null,
    qrCodeBase64: (txData?.qr_code_base64 as string | undefined) ?? null,
  };
}

export function isBookingDemoMode() {
  return process.env.BOOKING_DEMO_MODE === "true" || process.env.SIGNUP_DEMO_MODE === "true";
}
