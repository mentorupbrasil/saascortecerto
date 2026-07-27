import "server-only";

import { prisma } from "@/lib/prisma";
import { addMonths, format } from "date-fns";

function periodKeyFor(now: Date, periodStartAt: Date | null): string {
  const base = periodStartAt ?? now;
  return format(base, "yyyy-MM");
}

export async function recordMembershipVisit(
  membershipId: string,
  options?: { appointmentId?: string; tenantId?: string }
) {
  const membership = await prisma.clientMembership.findUnique({
    where: { id: membershipId },
    include: { plan: true },
  });
  if (!membership || membership.status !== "ACTIVE") return;
  if (options?.tenantId && membership.tenantId !== options.tenantId) return;

  const idempotencyKey = options?.appointmentId
    ? `appointment:${options.appointmentId}`
    : null;

  if (idempotencyKey) {
    const existing = await prisma.membershipRedemption.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return;
  }

  const now = new Date();
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

  await prisma.$transaction([
    prisma.clientMembership.update({
      where: { id: membershipId },
      data: {
        visitsUsedThisPeriod,
        totalVisitsUsed,
        periodStartAt,
        bonusEarned,
      },
    }),
    prisma.membershipRedemption.create({
      data: {
        tenantId: membership.tenantId,
        membershipId,
        appointmentId: options?.appointmentId ?? null,
        periodKey,
        idempotencyKey:
          idempotencyKey ?? `membership:${membershipId}:${now.toISOString()}`,
      },
    }),
  ]);
}
