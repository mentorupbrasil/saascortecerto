import type { ClientMembership, MembershipPlan } from "@prisma/client";
import { addMonths, isAfter } from "date-fns";
import { isWeekdayAllowed } from "./whatsapp";

export function getMembershipStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Ativo",
    PAUSED: "Pausado",
    CANCELLED: "Cancelado",
    EXPIRED: "Expirado",
  };
  return labels[status] ?? status;
}

export function computeMembershipExpiry(
  plan: Pick<MembershipPlan, "billingCycle">,
  startedAt: Date
): Date | null {
  if (plan.billingCycle === "MONTHLY") {
    return addMonths(startedAt, 1);
  }
  return null;
}

export function isMembershipExpired(membership: ClientMembership): boolean {
  if (membership.status !== "ACTIVE") return true;
  if (membership.expiresAt && isAfter(new Date(), membership.expiresAt)) return true;
  return false;
}

export function canUseMembershipToday(
  membership: ClientMembership,
  plan: MembershipPlan
): { ok: boolean; reason?: string } {
  if (isMembershipExpired(membership)) {
    return { ok: false, reason: "Assinatura expirada ou inativa" };
  }

  if (!isWeekdayAllowed(new Date(), plan.allowedWeekdays)) {
    return { ok: false, reason: "Hoje não é dia permitido no plano" };
  }

  if (plan.planType === "MONTHLY_UNLIMITED") {
    return { ok: true };
  }

  if (plan.planType === "MONTHLY_LIMITED" && plan.maxVisitsPerMonth != null) {
    if (membership.visitsUsedThisPeriod >= plan.maxVisitsPerMonth) {
      return { ok: false, reason: "Limite mensal de visitas atingido" };
    }
    return { ok: true };
  }

  if (plan.planType === "VISIT_PACK" && plan.totalVisits != null) {
    if (membership.totalVisitsUsed >= plan.totalVisits) {
      return { ok: false, reason: "Pacote de visitas esgotado" };
    }
    return { ok: true };
  }

  if (plan.planType === "LOYALTY") {
    return { ok: true };
  }

  return { ok: true };
}

export function getMembershipRemaining(
  membership: Pick<
    ClientMembership,
    "visitsUsedThisPeriod" | "totalVisitsUsed" | "bonusEarned"
  >,
  plan: Pick<
    MembershipPlan,
    "planType" | "maxVisitsPerMonth" | "totalVisits" | "bonusAfterVisits"
  > | {
    planType: string;
    maxVisitsPerMonth: number | null;
    totalVisits: number | null;
    bonusAfterVisits: number | null;
  }
): string {
  if (plan.planType === "MONTHLY_UNLIMITED") return "Ilimitado";
  if (plan.planType === "MONTHLY_LIMITED" && plan.maxVisitsPerMonth != null) {
    const left = plan.maxVisitsPerMonth - membership.visitsUsedThisPeriod;
    return `${Math.max(0, left)} restantes este mês`;
  }
  if (plan.planType === "VISIT_PACK" && plan.totalVisits != null) {
    const left = plan.totalVisits - membership.totalVisitsUsed;
    return `${Math.max(0, left)} visitas restantes`;
  }
  if (plan.planType === "LOYALTY" && plan.bonusAfterVisits != null) {
    const untilBonus = plan.bonusAfterVisits - (membership.totalVisitsUsed % plan.bonusAfterVisits);
    return `${untilBonus} cortes até o bônus`;
  }
  return "—";
}

export function checkBonusEarned(
  membership: ClientMembership,
  plan: MembershipPlan
): boolean {
  if (plan.planType !== "LOYALTY" || !plan.bonusAfterVisits) return false;
  return (
    membership.totalVisitsUsed > 0 &&
    membership.totalVisitsUsed % plan.bonusAfterVisits === 0
  );
}
