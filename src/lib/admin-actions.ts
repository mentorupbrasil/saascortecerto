"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { canManageTenants } from "@/lib/auth-utils";
import { getPlanPrice } from "@/lib/plan-pricing";
import type { Plan, SubscriptionPaymentStatus } from "@prisma/client";
import { z } from "zod";
import { startOfMonth, endOfMonth } from "date-fns";

const updatePlanSchema = z.object({
  tenantId: z.string(),
  plan: z.enum(["FREE", "PRO", "CLUBE"]),
});

const paymentSchema = z.object({
  tenantId: z.string(),
  plan: z.enum(["FREE", "PRO", "CLUBE"]),
  amount: z.coerce.number().min(0),
  status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]),
  dueDate: z.string(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function getPlatformBillingStats() {
  const user = await requireAuth();
  if (!canManageTenants(user)) throw new Error("Sem permissão");

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [tenants, payments, paidThisMonth] = await Promise.all([
    prisma.tenant.findMany({
      include: {
        _count: { select: { users: true, clients: true, appointments: true } },
        subscriptionPayments: { orderBy: { createdAt: "desc" }, take: 3 },
        users: { where: { role: "OWNER" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscriptionPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { tenant: { select: { name: true } } },
    }),
    prisma.subscriptionPayment.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const activeTenants = tenants.filter((t) => t.active);
  const mrr = activeTenants.reduce((sum, t) => sum + getPlanPrice(t.plan), 0);
  const pending = payments.filter((p) => p.status === "PENDING" || p.status === "OVERDUE");
  const pendingAmount = pending.reduce((s, p) => s + Number(p.amount), 0);

  return {
    mrr,
    revenueThisMonth: Number(paidThisMonth._sum.amount ?? 0),
    pendingCount: pending.length,
    pendingAmount,
    tenants,
    payments,
  };
}

export async function updateTenantPlan(formData: FormData) {
  const user = await requireAuth();
  if (!canManageTenants(user)) throw new Error("Sem permissão");

  const parsed = updatePlanSchema.parse({
    tenantId: formData.get("tenantId"),
    plan: formData.get("plan"),
  });

  await prisma.tenant.update({
    where: { id: parsed.tenantId },
    data: { plan: parsed.plan as Plan },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function recordSubscriptionPayment(formData: FormData) {
  const user = await requireAuth();
  if (!canManageTenants(user)) throw new Error("Sem permissão");

  const parsed = paymentSchema.parse({
    tenantId: formData.get("tenantId"),
    plan: formData.get("plan"),
    amount: formData.get("amount"),
    status: formData.get("status"),
    dueDate: formData.get("dueDate"),
    paidAt: formData.get("paidAt") || undefined,
    notes: formData.get("notes") || undefined,
  });

  await prisma.subscriptionPayment.create({
    data: {
      tenantId: parsed.tenantId,
      plan: parsed.plan as Plan,
      amount: parsed.amount,
      status: parsed.status as SubscriptionPaymentStatus,
      dueDate: new Date(parsed.dueDate),
      paidAt: parsed.paidAt ? new Date(parsed.paidAt) : parsed.status === "PAID" ? new Date() : null,
      notes: parsed.notes,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/faturamento");
  return { success: true };
}

export async function markPaymentPaid(paymentId: string) {
  const user = await requireAuth();
  if (!canManageTenants(user)) throw new Error("Sem permissão");

  await prisma.subscriptionPayment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/faturamento");
  return { success: true };
}

export async function generateMonthlyInvoices() {
  const user = await requireAuth();
  if (!canManageTenants(user)) throw new Error("Sem permissão");

  const tenants = await prisma.tenant.findMany({
    where: { active: true, plan: { not: "FREE" } },
  });

  const dueDate = new Date();
  dueDate.setDate(5);

  let created = 0;
  for (const tenant of tenants) {
    const amount = getPlanPrice(tenant.plan);
    if (amount === 0) continue;

    const existing = await prisma.subscriptionPayment.findFirst({
      where: {
        tenantId: tenant.id,
        dueDate: { gte: startOfMonth(new Date()), lte: endOfMonth(new Date()) },
      },
    });
    if (existing) continue;

    await prisma.subscriptionPayment.create({
      data: {
        tenantId: tenant.id,
        plan: tenant.plan,
        amount,
        status: "PENDING",
        dueDate,
      },
    });
    created++;
  }

  revalidatePath("/admin");
  return { created };
}
