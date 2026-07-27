import "server-only";

import { prisma } from "@/lib/prisma";
import { getPlanPrice } from "@/lib/plan-pricing";
import { endOfMonth, startOfMonth } from "date-fns";

export async function syncOverdueSubscriptionPayments() {
  const now = new Date();
  await prisma.subscriptionPayment.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
      tenantReportedPaidAt: null,
    },
    data: { status: "OVERDUE" },
  });
}

export async function ensureTenantIsActive(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { active: true },
  });
  return tenant?.active ?? false;
}

export async function autoGenerateMonthlyInvoices() {
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

  return { created };
}

export async function runBillingCron() {
  await syncOverdueSubscriptionPayments();
  const invoices = await autoGenerateMonthlyInvoices();
  return invoices;
}
