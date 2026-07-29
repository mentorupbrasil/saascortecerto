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

/** Same discount as GestorPro annual toggle (−20% on the monthly equivalent). */
export const PLAN_ANNUAL_DISCOUNT = 0.2;

export type PlanBilling = "monthly" | "yearly";

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
    "Agenda e clientes ilimitados",
    "Serviços com preço e duração",
    "Equipe com até 2 acessos",
    "Link de agendamento online",
    "Comandas, caixa e estoque",
    "Suporte humano",
  ],
  CLUBE: [
    "Tudo do plano Básico",
    "Até 4 acessos de equipe",
    "Relatórios e comissões",
    "Clube de assinatura",
    "WhatsApp automático",
    "Suporte prioritário",
  ],
};

export function getPlanPrice(plan: keyof typeof PLAN_PRICES) {
  return PLAN_PRICES[plan] ?? 0;
}

/** Monthly price shown on cards (annual mode = monthly × 0.8). */
export function getPlanDisplayMonthly(
  plan: keyof typeof PLAN_PRICES,
  billing: PlanBilling = "monthly"
) {
  const monthly = getPlanPrice(plan);
  if (billing === "yearly") {
    return Math.round(monthly * (1 - PLAN_ANNUAL_DISCOUNT) * 100) / 100;
  }
  return monthly;
}

/** Amount charged at checkout (yearly = 12 × discounted monthly). */
export function getPlanCheckoutAmount(
  plan: keyof typeof PLAN_PRICES,
  billing: PlanBilling = "monthly"
) {
  if (billing === "yearly") {
    return Math.round(getPlanDisplayMonthly(plan, "yearly") * 12 * 100) / 100;
  }
  return getPlanPrice(plan);
}

export function formatMoneyBRL(amount: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

export function formatPlanPrice(
  plan: keyof typeof PLAN_PRICES,
  billing: PlanBilling = "monthly"
) {
  const price = getPlanDisplayMonthly(plan, billing);
  if (price === 0) return "Grátis";
  return formatMoneyBRL(price);
}

/** Infer billing from charged amount (no DB column for billing cycle yet). */
export function inferPlanBilling(
  plan: keyof typeof PLAN_PRICES,
  amount: number
): PlanBilling {
  const yearly = getPlanCheckoutAmount(plan, "yearly");
  return Math.abs(amount - yearly) < 0.02 ? "yearly" : "monthly";
}

export function canUseManualWhatsApp(plan: Plan) {
  return plan === "PRO" || plan === "CLUBE";
}

export function canUseAutoWhatsApp(plan: Plan) {
  return plan === "CLUBE";
}
