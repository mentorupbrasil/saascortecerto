"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  requireTenantAdmin,
  requireTenantUser,
} from "@/lib/authz";
import { computeMembershipExpiry } from "@/lib/membership";
import { z } from "zod";
import type { MembershipPlanType, MembershipBilling } from "@prisma/client";

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
  const user = await requireTenantUser();
  await requirePermission("club:manage");
  const tenantId = user.tenantId;

  return prisma.membershipPlan.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    },
  });
}

export async function getActiveMemberships() {
  const user = await requireTenantUser();
  await requirePermission("club:manage");
  const tenantId = user.tenantId;

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
  await requirePermission("club:manage");
  const user = await requireTenantUser();
  const tenantId = user.tenantId;

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
  await requirePermission("club:manage");
  const user = await requireTenantUser();
  const tenantId = user.tenantId;

  await prisma.membershipPlan.updateMany({
    where: { id: planId, tenantId },
    data: { active },
  });

  revalidatePath("/clube");
  return { success: true };
}

export async function subscribeClient(formData: FormData) {
  await requirePermission("club:manage");
  const user = await requireTenantUser();
  const tenantId = user.tenantId;

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
  await requirePermission("club:manage");
  const user = await requireTenantUser();
  const tenantId = user.tenantId;

  await prisma.clientMembership.updateMany({
    where: { id: membershipId, tenantId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/clube");
  return { success: true };
}

export async function getClientActiveMembership(clientId: string) {
  const user = await requireTenantUser();
  await requirePermission("club:manage");
  const tenantId = user.tenantId;

  return prisma.clientMembership.findFirst({
    where: { clientId, tenantId, status: "ACTIVE" },
    include: { plan: true },
  });
}

export async function getClientsForSubscribe() {
  const user = await requireTenantUser();
  await requirePermission("club:manage");
  const tenantId = user.tenantId;

  return prisma.client.findMany({
    where: { tenantId },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });
}
