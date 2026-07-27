"use server";

import { revalidatePath } from "next/cache";
import {
  requireTenantUser,
  hasPermission,
  AuthError,
  type AuthenticatedUser,
  type Permission,
} from "@/lib/authz";
import {
  openCashSession,
  closeCashSession,
  addCashMovement,
  getOpenCashSession,
  serializeCashSession,
} from "@/lib/finance/cash";
import {
  createSale,
  addSaleItem,
  addSalePayment,
  cancelSale,
  listSales,
  getSaleById,
  getTodaySalesTotal,
  serializeSale,
} from "@/lib/finance/sales";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  listExpenseCategories,
  createExpenseCategory,
  getMonthExpensesTotal,
  serializeExpense,
} from "@/lib/finance/expenses";
import {
  listProducts,
  listProductCategories,
  createProduct,
  recordStockMovement,
  serializeProduct,
} from "@/lib/inventory/products";
import {
  listCommissionRules,
  listCommissionEntries,
  createCommissionRule,
  serializeCommissionEntry,
  periodKeyForDate,
} from "@/lib/commissions/engine";
import { prisma } from "@/lib/prisma";
import { getTenantTimezone } from "@/lib/timezone";
import type { CashMovementType, PaymentMethod, SaleItemKind } from "@prisma/client";

const FINANCE_PATHS = [
  "/financeiro",
  "/caixa",
  "/comandas",
  "/estoque",
  "/comissoes",
] as const;

function revalidateFinance() {
  for (const p of FINANCE_PATHS) revalidatePath(p);
}

async function financeCtx(): Promise<{ user: AuthenticatedUser & { tenantId: string } }> {
  const user = await requireTenantUser();
  return { user };
}

async function requireTenantPermission(
  permission: Permission
): Promise<AuthenticatedUser & { tenantId: string }> {
  const user = await requireTenantUser();
  if (!hasPermission(user, permission)) {
    throw new AuthError("FORBIDDEN", `Sem permissão: ${permission}`);
  }
  return user;
}

async function getTimeZone(tenantId: string) {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { timeZone: true },
  });
  return getTenantTimezone(settings?.timeZone);
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getFinanceOverview() {
  const user = await requireTenantPermission("finance:view");
  const tz = await getTimeZone(user.tenantId);

  const [todaySales, openCash, monthExpenses, openSalesCount] = await Promise.all([
    getTodaySalesTotal(user.tenantId, tz),
    getOpenCashSession(user.tenantId),
    getMonthExpensesTotal(user.tenantId, tz),
    prisma.sale.count({
      where: { tenantId: user.tenantId, status: { in: ["OPEN", "DRAFT"] } },
    }),
  ]);

  return {
    todaySales: Number(todaySales),
    monthExpenses: Number(monthExpenses),
    openCash: openCash ? serializeCashSession(openCash) : null,
    openSalesCount,
  };
}

// ---------------------------------------------------------------------------
// Cash
// ---------------------------------------------------------------------------

export async function getCashPanelData() {
  const user = await requireTenantPermission("finance:view");
  const openSession = await getOpenCashSession(user.tenantId);
  const recentSessions = await prisma.cashSession.findMany({
    where: { tenantId: user.tenantId },
    include: {
      operatorUser: { select: { name: true } },
      location: { select: { name: true } },
    },
    orderBy: { openedAt: "desc" },
    take: 10,
  });

  return {
    openSession: openSession ? serializeCashSession(openSession) : null,
    recentSessions: recentSessions.map(serializeCashSession),
    movements: openSession?.movements.map((m) => ({
      id: m.id,
      type: m.type,
      amount: Number(m.amount),
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
    })) ?? [],
  };
}

export async function openCashAction(openingBalance: number, notes?: string) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:sell") && !hasPermission(ctx.user, "finance:cash_close")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para abrir caixa");
  }
  const session = await openCashSession(ctx, { openingBalance, notes });
  revalidateFinance();
  return serializeCashSession(session);
}

export async function closeCashAction(sessionId: string, closingBalance: number, notes?: string) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:cash_close")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para fechar caixa");
  }
  const session = await closeCashSession(ctx, sessionId, { closingBalance, notes });
  revalidateFinance();
  return serializeCashSession(session);
}

export async function addCashMovementAction(
  sessionId: string,
  type: CashMovementType,
  amount: number,
  notes?: string
) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:sell") && !hasPermission(ctx.user, "finance:cash_close")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para movimentar caixa");
  }
  await addCashMovement(ctx, sessionId, { type, amount, notes });
  revalidateFinance();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Sales (comandas)
// ---------------------------------------------------------------------------

export async function getComandasPanelData() {
  const user = await requireTenantPermission("finance:sell");
  const tz = await getTimeZone(user.tenantId);
  const [sales, services, clients, barbers, openCash] = await Promise.all([
    listSales(user.tenantId, { limit: 40 }),
    prisma.service.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true },
    }),
    prisma.client.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
      take: 100,
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { tenantId: user.tenantId, active: true, role: { in: ["BARBER", "OWNER", "MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getOpenCashSession(user.tenantId),
  ]);

  return {
    sales: sales.map(serializeSale),
    services: services.map((s) => ({ id: s.id, name: s.name, price: Number(s.price) })),
    clients,
    barbers,
    openCashSessionId: openCash?.id ?? null,
    timeZone: tz,
  };
}

export async function createComandaAction(input: {
  clientId?: string;
  appointmentId?: string;
}) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:sell")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para registrar vendas");
  }
  const openCash = await getOpenCashSession(ctx.user.tenantId);
  const sale = await createSale(ctx, {
    ...input,
    cashSessionId: openCash?.id ?? undefined,
  });
  revalidateFinance();
  return { id: sale.id };
}

export async function addComandaItemAction(
  saleId: string,
  input: {
    kind: SaleItemKind;
    serviceId?: string;
    productId?: string;
    barberId?: string;
    quantity?: number;
  }
) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:sell")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para registrar vendas");
  }
  await addSaleItem(ctx, saleId, input);
  revalidateFinance();
  return { success: true };
}

export async function addComandaPaymentAction(
  saleId: string,
  method: PaymentMethod,
  amount: number
) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:sell")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para registrar pagamentos");
  }
  await addSalePayment(ctx, saleId, { method, amount });
  revalidateFinance();
  return { success: true };
}

export async function cancelComandaAction(saleId: string, reason?: string) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:sell")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para cancelar comanda");
  }
  await cancelSale(ctx, saleId, { reason });
  revalidateFinance();
  return { success: true };
}

export async function getComandaDetail(saleId: string) {
  const user = await requireTenantPermission("finance:sell");
  const sale = await getSaleById(user.tenantId, saleId);
  if (!sale) return null;
  return {
    ...serializeSale(sale),
    items: sale.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
      barberName: i.barber?.name ?? null,
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
    })),
  };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function getExpensesPanelData() {
  const user = await requireTenantPermission("finance:view");
  const tz = await getTimeZone(user.tenantId);
  const [expenses, categories] = await Promise.all([
    listExpenses(user.tenantId, { timeZone: tz, limit: 30 }),
    listExpenseCategories(user.tenantId),
  ]);

  return {
    expenses: expenses.map(serializeExpense),
    categories,
    monthTotal: Number(await getMonthExpensesTotal(user.tenantId, tz)),
  };
}

export async function createExpenseAction(input: {
  categoryId: string;
  amount: number;
  description?: string;
}) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:view")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para registrar despesas");
  }
  await createExpense(ctx, input);
  revalidateFinance();
  return { success: true };
}

export async function createExpenseCategoryAction(name: string) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:view")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para gerenciar despesas");
  }
  await createExpenseCategory(ctx, { name });
  revalidateFinance();
  return { success: true };
}

export async function deleteExpenseAction(expenseId: string) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "finance:view")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para excluir despesas");
  }
  await deleteExpense(ctx, expenseId);
  revalidateFinance();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export async function getEstoquePanelData() {
  const user = await requireTenantPermission("inventory:view");
  const [products, categories] = await Promise.all([
    listProducts(user.tenantId),
    listProductCategories(user.tenantId),
  ]);

  return {
    products: products.map(serializeProduct),
    categories,
    lowStockCount: products.filter((p) => p.stockQty <= 5).length,
  };
}

export async function createProductAction(input: {
  name: string;
  sku?: string;
  price: number;
  cost?: number;
  categoryId?: string;
  initialStock?: number;
}) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "inventory:adjust")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para cadastrar produtos");
  }
  await createProduct(ctx, input);
  revalidateFinance();
  return { success: true };
}

export async function adjustStockAction(productId: string, quantity: number, notes?: string) {
  const ctx = await financeCtx();
  if (!hasPermission(ctx.user, "inventory:adjust")) {
    throw new AuthError("FORBIDDEN", "Sem permissão para ajustar estoque");
  }
  const absQty = Math.abs(quantity);
  if (absQty <= 0) throw new Error("Quantidade inválida");
  await recordStockMovement(ctx, {
    productId,
    type: quantity > 0 ? "IN" : "OUT",
    quantity: absQty,
    notes: notes ?? "Ajuste manual",
  });
  revalidateFinance();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

export async function getComissoesPanelData() {
  const user = await requireTenantPermission("finance:view");
  const tz = await getTimeZone(user.tenantId);
  const periodKey = periodKeyForDate(new Date(), tz);

  const [rules, entries, barbers, services] = await Promise.all([
    listCommissionRules(user.tenantId),
    listCommissionEntries(user.tenantId, { periodKey, limit: 40 }),
    prisma.user.findMany({
      where: { tenantId: user.tenantId, active: true, role: { in: ["BARBER", "OWNER", "MANAGER"] } },
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: { tenantId: user.tenantId, active: true },
      select: { id: true, name: true },
    }),
  ]);

  const periodTotal = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    periodKey,
    periodTotal,
    rules: rules.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      rate: Number(r.rate),
      active: r.active,
      serviceName: r.service?.name ?? null,
      barberName: r.barber?.name ?? null,
    })),
    entries: entries.map(serializeCommissionEntry),
    barbers,
    services,
  };
}

export async function createCommissionRuleAction(input: {
  name: string;
  type: "PERCENTAGE" | "FIXED";
  rate: number;
  serviceId?: string;
  barberId?: string;
}) {
  const user = await requireTenantPermission("finance:view");
  await createCommissionRule(user.tenantId, input);
  revalidateFinance();
  return { success: true };
}
