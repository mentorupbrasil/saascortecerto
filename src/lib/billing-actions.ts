"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import { getPlanPrice, PLAN_LABELS } from "@/lib/plan-pricing";
import { getPlatformPixConfig } from "@/lib/platform-billing";
import { generatePixCopiaECola } from "@/lib/pix";
import { differenceInCalendarDays, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import type { Plan, SubscriptionPaymentStatus } from "@prisma/client";

export type BillingAlertLevel = "none" | "upcoming" | "due_soon" | "overdue";

export type BillingAlertProps = {
  level: BillingAlertLevel;
  message: string | null;
  invoiceId: string | null;
  amount: number | null;
  dueDate: string | null;
};

export type TenantInvoiceRow = {
  id: string;
  plan: Plan;
  planLabel: string;
  amount: number;
  status: SubscriptionPaymentStatus;
  statusLabel: string;
  dueDate: string;
  paidAt: string | null;
  tenantReportedPaidAt: string | null;
  createdAt: string;
  canPay: boolean;
};

export type TenantBillingOverview = {
  plan: Plan;
  planLabel: string;
  planPrice: number;
  invoices: TenantInvoiceRow[];
  openInvoice: TenantInvoiceRow | null;
  alertLevel: BillingAlertLevel;
  alertMessage: string | null;
  daysUntilDue: number | null;
  hasAwaitingConfirmation: boolean;
  pixConfigured: boolean;
};

const STATUS_LABELS: Record<SubscriptionPaymentStatus, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

function serializeInvoice(p: {
  id: string;
  plan: Plan;
  amount: unknown;
  status: SubscriptionPaymentStatus;
  dueDate: Date;
  paidAt: Date | null;
  tenantReportedPaidAt: Date | null;
  createdAt: Date;
}): TenantInvoiceRow {
  const canPay =
    (p.status === "PENDING" || p.status === "OVERDUE") && !p.tenantReportedPaidAt;

  return {
    id: p.id,
    plan: p.plan,
    planLabel: PLAN_LABELS[p.plan],
    amount: Number(p.amount),
    status: p.status,
    statusLabel: p.tenantReportedPaidAt && p.status !== "PAID"
      ? "Aguardando confirmação"
      : STATUS_LABELS[p.status],
    dueDate: p.dueDate.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
    tenantReportedPaidAt: p.tenantReportedPaidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    canPay,
  };
}

function buildAlert(openInvoice: TenantInvoiceRow | null): {
  alertLevel: BillingAlertLevel;
  alertMessage: string | null;
  daysUntilDue: number | null;
} {
  if (!openInvoice) {
    return { alertLevel: "none", alertMessage: null, daysUntilDue: null };
  }

  const daysUntilDue = differenceInCalendarDays(
    startOfDay(new Date(openInvoice.dueDate)),
    startOfDay(new Date())
  );

  if (openInvoice.status === "OVERDUE" || daysUntilDue < 0) {
    return {
      alertLevel: "overdue",
      alertMessage: "Sua fatura está vencida. Regularize o pagamento para evitar bloqueio da conta.",
      daysUntilDue,
    };
  }

  if (daysUntilDue <= 3) {
    return {
      alertLevel: "due_soon",
      alertMessage: `Fatura vence em ${daysUntilDue === 0 ? "hoje" : `${daysUntilDue} dia(s)`}. Pague pelo app para evitar interrupção.`,
      daysUntilDue,
    };
  }

  if (daysUntilDue <= 7) {
    return {
      alertLevel: "upcoming",
      alertMessage: `Próximo vencimento em ${daysUntilDue} dias.`,
      daysUntilDue,
    };
  }

  return { alertLevel: "none", alertMessage: null, daysUntilDue };
}

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

export async function getTenantBillingOverview(tenantId: string): Promise<TenantBillingOverview> {
  await syncOverdueSubscriptionPayments();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });

  if (!tenant) throw new Error("Barbearia não encontrada");

  const payments = await prisma.subscriptionPayment.findMany({
    where: { tenantId },
    orderBy: { dueDate: "desc" },
    take: 24,
  });

  const invoices = payments.map(serializeInvoice);
  const openInvoice =
    invoices.find((p) => p.status === "PENDING" || p.status === "OVERDUE") ?? null;

  const alert = buildAlert(openInvoice);

  return {
    plan: tenant.plan,
    planLabel: PLAN_LABELS[tenant.plan],
    planPrice: getPlanPrice(tenant.plan),
    invoices,
    openInvoice,
    hasAwaitingConfirmation: invoices.some(
      (p) => p.tenantReportedPaidAt && p.status !== "PAID"
    ),
    pixConfigured: !!getPlatformPixConfig(),
    ...alert,
  };
}

export async function getTenantBillingForSession() {
  const user = await requireAuth();
  if (!user.tenantId || !isTenantAdmin(user)) return null;
  return getTenantBillingOverview(user.tenantId);
}

export async function getTenantPaymentPixPayload(paymentId: string) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");

  const tenantId = requireTenantId(user);
  const pix = getPlatformPixConfig();
  if (!pix) throw new Error("PIX da plataforma não configurado. Contate o suporte.");

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: paymentId, tenantId },
  });

  if (!payment) throw new Error("Fatura não encontrada");
  if (payment.status === "PAID") throw new Error("Esta fatura já está paga");
  if (payment.status === "CANCELLED") throw new Error("Esta fatura foi cancelada");

  const amount = Number(payment.amount);
  const copiaECola = generatePixCopiaECola({
    pixKey: pix.pixKey,
    merchantName: pix.merchantName,
    merchantCity: pix.merchantCity,
    amount,
    txId: payment.id.slice(-20),
  });

  return {
    paymentId: payment.id,
    amount,
    planLabel: PLAN_LABELS[payment.plan],
    dueDate: payment.dueDate.toISOString(),
    pixKey: pix.pixKey,
    merchantName: pix.merchantName,
    copiaECola,
  };
}

export async function reportTenantPayment(paymentId: string) {
  const user = await requireAuth();
  if (user.role !== "OWNER") throw new Error("Apenas o dono pode confirmar pagamento");

  const tenantId = requireTenantId(user);
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: paymentId, tenantId },
  });

  if (!payment) throw new Error("Fatura não encontrada");
  if (payment.status === "PAID") throw new Error("Fatura já paga");
  if (payment.status === "CANCELLED") throw new Error("Fatura cancelada");

  const now = new Date();
  const note = `Pagamento informado pelo cliente em ${now.toLocaleString("pt-BR")} (${user.email})`;

  await prisma.subscriptionPayment.update({
    where: { id: paymentId },
    data: {
      tenantReportedPaidAt: now,
      notes: payment.notes ? `${payment.notes}\n${note}` : note,
    },
  });

  revalidatePath("/faturamento");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: true };
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
