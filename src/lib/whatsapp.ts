import type { TenantSettings } from "@prisma/client";
import { decryptCredential } from "@/lib/crypto/credentials";
import { isWhatsAppDemoMode } from "@/lib/env";

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
};

function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

export function renderMessageTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

export async function sendWhatsAppText(
  settings: Pick<
    TenantSettings,
    "whatsappPhoneNumberId" | "whatsappAccessToken" | "whatsappEnabled"
  >,
  phone: string,
  message: string
): Promise<WhatsAppSendResult> {
  if (isWhatsAppDemoMode()) {
    return { success: true, simulated: true, messageId: `demo-${Date.now()}` };
  }

  if (!settings.whatsappEnabled) {
    return { success: false, error: "WhatsApp desativado nas configurações" };
  }

  const accessToken = decryptCredential(settings.whatsappAccessToken);
  if (!settings.whatsappPhoneNumberId || !accessToken) {
    return { success: false, error: "WhatsApp API não configurada" };
  }

  const to = formatPhoneE164(phone);

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${settings.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: message },
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data?.error?.message ?? `HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro de rede",
    };
  }
}

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export { parseWeekdays, isWeekdayAllowed } from "@/lib/weekdays";

export { PLAN_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/constants/labels";
