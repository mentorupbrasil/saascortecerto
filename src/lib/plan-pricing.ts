import type { Plan } from "@prisma/client";

/**
 * SaaS plan prices — single source of truth for landing + checkout.
 * UI labels: PRO → "Básico", CLUBE → "Pro" (enum kept for DB compatibility).
 */
export const PLAN_PRICES = {
  FREE: 0,
  PRO: 49.9,
  CLUBE: 69.9,
} as const;

export const PLAN_LABELS: Record<keyof typeof PLAN_PRICES, string> = {
  FREE: "Grátis",
  PRO: "Básico",
  CLUBE: "Pro",
};

/** Announced seat counts on the marketing site. NOT enforced in app code yet. */
export const PLAN_SEAT_LIMITS: Record<Plan, number> = {
  FREE: 1,
  PRO: 2,
  CLUBE: 4,
};

/** Flip to true only after seat enforcement is implemented end-to-end. */
export const PLAN_SEATS_ENFORCED = false;

export const PLAN_WHATSAPP_DESCRIPTION: Record<Plan, string> = {
  FREE: "Sem retorno por WhatsApp",
  PRO: "Alertas + envio manual (wa.me)",
  CLUBE: "Disparo automático via API",
};

export const PLAN_MARKETING_FEATURES: Record<"PRO" | "CLUBE", string[]> = {
  PRO: [
    "Agenda e clientes",
    "Cadastro de serviços",
    "Gestão de profissionais",
    "Link de agendamento",
    "Controle da operação",
    "Suporte humano",
  ],
  CLUBE: [
    "Tudo do plano Básico",
    "Mais acessos para a equipe",
    "Relatórios completos",
    "Recursos avançados",
    "Automações disponíveis",
    "Suporte prioritário",
  ],
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
