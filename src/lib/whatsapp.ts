import type { TenantSettings } from "@prisma/client";

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

export async function sendWhatsAppText(
  settings: Pick<
    TenantSettings,
    "whatsappPhoneNumberId" | "whatsappAccessToken" | "whatsappEnabled"
  >,
  phone: string,
  message: string
): Promise<WhatsAppSendResult> {
  const demoMode =
    process.env.WHATSAPP_DEMO_MODE === "true" ||
    !settings.whatsappPhoneNumberId ||
    !settings.whatsappAccessToken;

  if (demoMode) {
    return { success: true, simulated: true, messageId: `demo-${Date.now()}` };
  }

  if (!settings.whatsappEnabled) {
    return { success: false, error: "WhatsApp desativado nas configurações" };
  }

  const to = formatPhoneE164(phone);

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${settings.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.whatsappAccessToken}`,
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

export function parseWeekdays(allowedWeekdays: string): number[] {
  return allowedWeekdays.split(",").map((d) => parseInt(d.trim(), 10));
}

export function isWeekdayAllowed(date: Date, allowedWeekdays: string): boolean {
  const allowed = parseWeekdays(allowedWeekdays);
  return allowed.includes(date.getDay());
}

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const PLAN_TYPE_LABELS: Record<string, string> = {
  MONTHLY_LIMITED: "Mensal — X cortes/mês",
  MONTHLY_UNLIMITED: "Mensal — ilimitado",
  VISIT_PACK: "Pacote de visitas",
  LOYALTY: "Fidelidade — bônus após X cortes",
};
