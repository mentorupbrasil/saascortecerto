import "server-only";

import { prisma } from "@/lib/prisma";
import { addMonths, format } from "date-fns";
import { Prisma } from "@prisma/client";
import { isWeekdayAllowed } from "@/lib/weekdays";

function periodKeyFor(now: Date, periodStartAt: Date | null): string {
  const base = periodStartAt ?? now;
  return format(base, "yyyy-MM");
}

type RedemptionContext = {
  appointmentId?: string;
  tenantId?: string;
  /** Weekday check uses appointment date when set, otherwise now */
  visitDate?: Date;
};

function validateMembershipForRedemption(
  membership: {
    status: string;
    expiresAt: Date | null;
    visitsUsedThisPeriod: number;
    totalVisitsUsed: number;
    periodStartAt: Date | null;
    tenantId: string;
  },
  plan: {
    planType: string;
    maxVisitsPerMonth: number | null;
    totalVisits: number | null;
    allowedWeekdays: string;
    billingCycle: string;
  },
  ctx: RedemptionContext
): { ok: true } | { ok: false; reason: string } {
  if (membership.status !== "ACTIVE") {
    return { ok: false, reason: "Assinatura inativa" };
  }

  const now = ctx.visitDate ?? new Date();
  if (membership.expiresAt && now > membership.expiresAt) {
    return { ok: false, reason: "Assinatura expirada" };
  }

  if (ctx.tenantId && membership.tenantId !== ctx.tenantId) {
    return { ok: false, reason: "Assinatura de outra barbearia" };
  }

  if (!isWeekdayAllowed(now, plan.allowedWeekdays)) {
    return { ok: false, reason: "Dia não permitido no plano" };
  }

  // MembershipPlan has no service/professional/location allowlists in schema — skip those checks.

  let visitsUsedThisPeriod = membership.visitsUsedThisPeriod;
  let periodStartAt = membership.periodStartAt;

  if (
    plan.billingCycle === "MONTHLY" &&
    periodStartAt &&
    now > addMonths(periodStartAt, 1)
  ) {
    visitsUsedThisPeriod = 0;
    periodStartAt = now;
  }

  if (plan.planType === "MONTHLY_UNLIMITED") {
    return { ok: true };
  }

  if (plan.planType === "MONTHLY_LIMITED" && plan.maxVisitsPerMonth != null) {
    if (visitsUsedThisPeriod >= plan.maxVisitsPerMonth) {
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

export async function recordMembershipVisit(
  membershipId: string,
  options?: RedemptionContext
) {
  const idempotencyKey = options?.appointmentId
    ? `appointment:${options.appointmentId}`
    : null;

  if (idempotencyKey) {
    const existing = await prisma.membershipRedemption.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return;
  }

  let visitDate = options?.visitDate ?? new Date();
  if (options?.appointmentId) {
    const apt = await prisma.appointment.findUnique({
      where: { id: options.appointmentId },
      select: { scheduledAt: true },
    });
    if (apt) visitDate = apt.scheduledAt;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.membershipRedemption.findUnique({
          where: { idempotencyKey },
        });
        if (existing) return;
      }

      const membership = await tx.clientMembership.findUnique({
        where: { id: membershipId },
        include: { plan: true },
      });
      if (!membership) return;

      const validation = validateMembershipForRedemption(
        membership,
        membership.plan,
        { ...options, visitDate }
      );
      if (!validation.ok) return;

      const now = visitDate;
      let visitsUsedThisPeriod = membership.visitsUsedThisPeriod + 1;
      let periodStartAt = membership.periodStartAt;
      let bonusEarned = membership.bonusEarned;

      if (
        membership.plan.billingCycle === "MONTHLY" &&
        periodStartAt &&
        now > addMonths(periodStartAt, 1)
      ) {
        visitsUsedThisPeriod = 1;
        periodStartAt = now;
      }

      const totalVisitsUsed = membership.totalVisitsUsed + 1;

      if (
        membership.plan.planType === "LOYALTY" &&
        membership.plan.bonusAfterVisits &&
        totalVisitsUsed % membership.plan.bonusAfterVisits === 0
      ) {
        bonusEarned += 1;
      }

      const periodKey = periodKeyFor(now, periodStartAt);

      await tx.clientMembership.update({
        where: { id: membershipId },
        data: {
          visitsUsedThisPeriod,
          totalVisitsUsed,
          periodStartAt,
          bonusEarned,
        },
      });

      await tx.membershipRedemption.create({
        data: {
          tenantId: membership.tenantId,
          membershipId,
          appointmentId: options?.appointmentId ?? null,
          periodKey,
          idempotencyKey:
            idempotencyKey ?? `membership:${membershipId}:${now.toISOString()}`,
        },
      });
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return;
    }
    throw err;
  }
}
