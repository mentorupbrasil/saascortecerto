import type { Plan } from "@prisma/client";

export const PLAN_PRICES = {
  FREE: 0,
  PRO: 39.9,
  CLUBE: 59.9,
} as const;

export const PLAN_LABELS: Record<keyof typeof PLAN_PRICES, string> = {
  FREE: "Grátis",
  PRO: "Pro",
  CLUBE: "Completo",
};

export const PLAN_WHATSAPP_DESCRIPTION: Record<Plan, string> = {
  FREE: "Sem retorno por WhatsApp",
  PRO: "Alertas + envio manual (wa.me)",
  CLUBE: "Disparo automático via API",
};

export function getPlanPrice(plan: keyof typeof PLAN_PRICES) {
  return PLAN_PRICES[plan] ?? 0;
}

export function formatPlanPrice(plan: keyof typeof PLAN_PRICES) {
  const price = getPlanPrice(plan);
  if (price === 0) return "Grátis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

export function canUseManualWhatsApp(plan: Plan) {
  return plan === "PRO" || plan === "CLUBE";
}

export function canUseAutoWhatsApp(plan: Plan) {
  return plan === "CLUBE";
}
