"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import { computeMembershipExpiry } from "@/lib/membership";
import { z } from "zod";
import type { MembershipPlanType, MembershipBilling } from "@prisma/client";
import { addMonths } from "date-fns";

const planSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  billingCycle: z.enum(["MONTHLY", "ONE_TIME"]),
  planType: z.enum([
    "MONTHLY_LIMITED",
    "MONTHLY_UNLIMITED",
    "VISIT_PACK",
    "LOYALTY",
  ]),
  maxVisitsPerMonth: z.coerce.number().optional(),
  totalVisits: z.coerce.number().optional(),
  allowedWeekdays: z.string().optional(),
  bonusAfterVisits: z.coerce.number().optional(),
  bonusDescription: z.string().optional(),
});

const subscribeSchema = z.object({
  clientId: z.string(),
  planId: z.string(),
  notes: z.string().optional(),
});

export async function getMembershipPlans() {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  return prisma.membershipPlan.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    },
  });
}

export async function getActiveMemberships() {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  return prisma.clientMembership.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: {
      client: { select: { id: true, name: true, phone: true, photoUrl: true } },
      plan: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMembershipPlan(formData: FormData) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  const parsed = planSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    billingCycle: formData.get("billingCycle"),
    planType: formData.get("planType"),
    maxVisitsPerMonth: formData.get("maxVisitsPerMonth") || undefined,
    totalVisits: formData.get("totalVisits") || undefined,
    allowedWeekdays: formData.get("allowedWeekdays") || "0,1,2,3,4,5,6",
    bonusAfterVisits: formData.get("bonusAfterVisits") || undefined,
    bonusDescription: formData.get("bonusDescription") || undefined,
  });

  await prisma.membershipPlan.create({
    data: {
      tenantId,
      name: parsed.name,
      description: parsed.description,
      price: parsed.price,
      billingCycle: parsed.billingCycle as MembershipBilling,
      planType: parsed.planType as MembershipPlanType,
      maxVisitsPerMonth: parsed.maxVisitsPerMonth ?? null,
      totalVisits: parsed.totalVisits ?? null,
      allowedWeekdays: parsed.allowedWeekdays ?? "0,1,2,3,4,5,6",
      bonusAfterVisits: parsed.bonusAfterVisits ?? null,
      bonusDescription: parsed.bonusDescription ?? null,
    },
  });

  revalidatePath("/clube");
  return { success: true };
}

export async function toggleMembershipPlan(planId: string, active: boolean) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  await prisma.membershipPlan.updateMany({
    where: { id: planId, tenantId },
    data: { active },
  });

  revalidatePath("/clube");
  return { success: true };
}

export async function subscribeClient(formData: FormData) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  const parsed = subscribeSchema.parse({
    clientId: formData.get("clientId"),
    planId: formData.get("planId"),
    notes: formData.get("notes") || undefined,
  });

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: parsed.planId, tenantId, active: true },
  });
  if (!plan) throw new Error("Plano não encontrado");

  const client = await prisma.client.findFirst({
    where: { id: parsed.clientId, tenantId },
  });
  if (!client) throw new Error("Cliente não encontrado");

  const startedAt = new Date();
  const expiresAt = computeMembershipExpiry(plan, startedAt);

  await prisma.clientMembership.create({
    data: {
      tenantId,
      clientId: parsed.clientId,
      planId: parsed.planId,
      startedAt,
      expiresAt,
      periodStartAt: startedAt,
      notes: parsed.notes,
    },
  });

  revalidatePath("/clube");
  revalidatePath("/clientes");
  return { success: true };
}

export async function cancelMembership(membershipId: string) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  await prisma.clientMembership.updateMany({
    where: { id: membershipId, tenantId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/clube");
  return { success: true };
}

export async function recordMembershipVisit(membershipId: string) {
  const membership = await prisma.clientMembership.findUnique({
    where: { id: membershipId },
    include: { plan: true },
  });
  if (!membership || membership.status !== "ACTIVE") return;

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

  await prisma.clientMembership.update({
    where: { id: membershipId },
    data: {
      visitsUsedThisPeriod,
      totalVisitsUsed,
      periodStartAt,
      bonusEarned,
    },
  });
}

export async function getClientActiveMembership(clientId: string, tenantId: string) {
  return prisma.clientMembership.findFirst({
    where: { clientId, tenantId, status: "ACTIVE" },
    include: { plan: true },
  });
}

export async function getClientsForSubscribe() {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  return prisma.client.findMany({
    where: { tenantId },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });
}
