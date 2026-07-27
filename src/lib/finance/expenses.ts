import "server-only";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { assertTenantResource, hasPermission, type AuthenticatedUser } from "@/lib/authz";

export type ExpenseContext = {
  user: AuthenticatedUser & { tenantId: string };
};

function toDecimal(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export async function listExpenseCategories(tenantId: string) {
  return prisma.expenseCategory.findMany({
    where: { tenantId, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createExpenseCategory(
  ctx: ExpenseContext,
  input: { name: string }
) {
  if (!hasPermission(ctx.user, "finance:view")) {
    throw new Error("Sem permissão para gerenciar despesas");
  }

  return prisma.expenseCategory.create({
    data: {
      tenantId: ctx.user.tenantId,
      name: input.name.trim(),
      active: true,
    },
  });
}

export async function createExpense(
  ctx: ExpenseContext,
  input: {
    categoryId: string;
    amount: number | string;
    description?: string | null;
    locationId?: string | null;
    paidAt?: Date | string | null;
  }
) {
  if (!hasPermission(ctx.user, "finance:view")) {
    throw new Error("Sem permissão para registrar despesas");
  }

  const category = await prisma.expenseCategory.findFirst({
    where: { id: input.categoryId, tenantId: ctx.user.tenantId, active: true },
  });
  if (!category) throw new Error("Categoria não encontrada");

  const amount = toDecimal(input.amount);
  if (amount.lte(0)) throw new Error("Valor deve ser positivo");

  return prisma.expense.create({
    data: {
      tenantId: ctx.user.tenantId,
      categoryId: input.categoryId,
      amount,
      description: input.description?.trim() ?? null,
      locationId: input.locationId ?? null,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      createdByUserId: ctx.user.id,
    },
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function updateExpense(
  ctx: ExpenseContext,
  expenseId: string,
  input: {
    categoryId?: string;
    amount?: number | string;
    description?: string | null;
    paidAt?: Date | string;
  }
) {
  if (!hasPermission(ctx.user, "finance:view")) {
    throw new Error("Sem permissão para editar despesas");
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, tenantId: ctx.user.tenantId },
  });
  if (!expense) throw new Error("Despesa não encontrada");
  assertTenantResource(ctx.user, expense.tenantId);

  if (input.categoryId) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: input.categoryId, tenantId: ctx.user.tenantId },
    });
    if (!category) throw new Error("Categoria não encontrada");
  }

  return prisma.expense.update({
    where: { id: expenseId },
    data: {
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.amount != null ? { amount: toDecimal(input.amount) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.paidAt ? { paidAt: new Date(input.paidAt) } : {}),
    },
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function deleteExpense(ctx: ExpenseContext, expenseId: string) {
  if (!hasPermission(ctx.user, "finance:view")) {
    throw new Error("Sem permissão para excluir despesas");
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, tenantId: ctx.user.tenantId },
  });
  if (!expense) throw new Error("Despesa não encontrada");

  await prisma.expense.delete({ where: { id: expenseId } });
  return { success: true };
}

export async function listExpenses(
  tenantId: string,
  opts?: { monthKey?: string; limit?: number; timeZone?: string }
) {
  const where: {
    tenantId: string;
    paidAt?: { gte: Date; lt: Date };
  } = { tenantId };

  if (opts?.monthKey && opts.timeZone) {
    const [year, month] = opts.monthKey.split("-").map(Number);
    const { wallTimeToUtc } = await import("@/lib/timezone");
    const start = wallTimeToUtc(
      `${year}-${String(month).padStart(2, "0")}-01`,
      "00:00",
      opts.timeZone
    );
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const end = wallTimeToUtc(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
      "00:00",
      opts.timeZone
    );
    where.paidAt = { gte: start, lt: end };
  }

  return prisma.expense.findMany({
    where,
    include: { category: { select: { id: true, name: true } } },
    orderBy: { paidAt: "desc" },
    take: opts?.limit ?? 50,
  });
}

export async function getMonthExpensesTotal(
  tenantId: string,
  timeZone: string,
  monthKey?: string
) {
  const { zonedParts } = await import("@/lib/timezone");
  const ref = monthKey ? new Date(`${monthKey}-15T12:00:00Z`) : new Date();
  const p = zonedParts(ref, timeZone);
  const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
  const expenses = await listExpenses(tenantId, { monthKey: key, timeZone, limit: 500 });
  return expenses.reduce((sum, e) => sum.plus(toDecimal(e.amount)), new Decimal(0));
}

export type SerializedExpense = {
  id: string;
  categoryName: string;
  amount: number;
  description: string | null;
  paidAt: string;
};

export function serializeExpense(e: {
  id: string;
  amount: { toString(): string };
  description: string | null;
  paidAt: Date;
  category: { name: string };
}): SerializedExpense {
  return {
    id: e.id,
    categoryName: e.category.name,
    amount: Number(e.amount),
    description: e.description,
    paidAt: e.paidAt.toISOString(),
  };
}
