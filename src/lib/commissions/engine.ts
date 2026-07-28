import "server-only";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma, type CommissionRule, type SaleItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zonedParts } from "@/lib/timezone";
import { DEFAULT_TENANT_TIMEZONE } from "@/lib/timezone";

type DbClient = Prisma.TransactionClient | typeof prisma;

function toDecimal(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export function periodKeyForDate(date: Date, timeZone = DEFAULT_TENANT_TIMEZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/**
 * Resolves the best matching commission rule for a sale item.
 * More specific rules (barber + service) win over generic ones.
 * Rule changes never affect existing CommissionEntry rows — only new computations.
 */
export function computeCommissionAmount(
  itemTotal: Decimal,
  rule: Pick<CommissionRule, "type" | "rate">
): Decimal {
  if (rule.type === "PERCENTAGE") {
    return itemTotal.mul(rule.rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  return toDecimal(rule.rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export async function findCommissionRuleForSaleItem(
  tenantId: string,
  saleItem: Pick<SaleItem, "serviceId" | "barberId">
) {
  const rules = await prisma.commissionRule.findMany({
    where: { tenantId, active: true },
    orderBy: { updatedAt: "desc" },
  });

  const scored = rules
    .map((rule) => {
      if (rule.barberId && rule.barberId !== saleItem.barberId) return null;
      if (rule.serviceId && rule.serviceId !== saleItem.serviceId) return null;
      if (!saleItem.barberId) return null;

      const specificity =
        (rule.barberId ? 2 : 0) + (rule.serviceId ? 1 : 0);
      return { rule, specificity };
    })
    .filter(Boolean) as { rule: CommissionRule; specificity: number }[];

  scored.sort((a, b) => b.specificity - a.specificity);
  return scored[0]?.rule ?? null;
}

/** Creates an immutable commission entry snapshot for a sale item. Idempotent per saleItemId. */
export async function createCommissionEntryForSaleItem(
  tenantId: string,
  saleItemId: string,
  timeZone?: string | null,
  db: DbClient = prisma
) {
  const saleItem = await db.saleItem.findFirst({
    where: { id: saleItemId, tenantId },
    include: { sale: { select: { closedAt: true, createdAt: true, status: true } } },
  });
  if (!saleItem) throw new Error("Item da venda não encontrado");
  if (!saleItem.barberId) return null;
  if (saleItem.sale.status === "CANCELLED") return null;

  const rule = await findCommissionRuleForSaleItem(tenantId, saleItem);
  if (!rule) return null;

  const amount = computeCommissionAmount(toDecimal(saleItem.total), rule);
  if (amount.lte(0)) return null;

  const refDate = saleItem.sale.closedAt ?? saleItem.sale.createdAt;
  const periodKey = periodKeyForDate(refDate, timeZone ?? DEFAULT_TENANT_TIMEZONE);

  try {
    return await db.commissionEntry.create({
      data: {
        tenantId,
        ruleId: rule.id,
        barberId: saleItem.barberId,
        saleItemId,
        amount,
        periodKey,
        kind: "EARNED",
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const existing = await db.commissionEntry.findFirst({
        where: { saleItemId, kind: "EARNED" },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

/**
 * Reverses a previously earned commission for a sale item (e.g. on sale cancellation).
 * Idempotent: if no EARNED entry exists, returns null; if a REVERSAL already exists,
 * returns it instead of creating a duplicate.
 */
export async function reverseCommissionForSaleItem(
  tenantId: string,
  saleItemId: string,
  timeZone?: string | null,
  db: DbClient = prisma
) {
  const earned = await db.commissionEntry.findFirst({
    where: { tenantId, saleItemId, kind: "EARNED" },
  });
  if (!earned) return null;

  const existingReversal = await db.commissionEntry.findFirst({
    where: { reversesEntryId: earned.id },
  });
  if (existingReversal) return existingReversal;

  try {
    return await db.commissionEntry.create({
      data: {
        tenantId,
        ruleId: earned.ruleId,
        barberId: earned.barberId,
        saleItemId,
        amount: toDecimal(earned.amount).neg(),
        periodKey: earned.periodKey,
        kind: "REVERSAL",
        reversesEntryId: earned.id,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const existing = await db.commissionEntry.findFirst({
        where: { reversesEntryId: earned.id },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

export async function listCommissionRules(tenantId: string) {
  return prisma.commissionRule.findMany({
    where: { tenantId },
    include: {
      service: { select: { id: true, name: true } },
      barber: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listCommissionEntries(
  tenantId: string,
  opts?: { periodKey?: string; barberId?: string; limit?: number }
) {
  return prisma.commissionEntry.findMany({
    where: {
      tenantId,
      ...(opts?.periodKey ? { periodKey: opts.periodKey } : {}),
      ...(opts?.barberId ? { barberId: opts.barberId } : {}),
    },
    include: {
      barber: { select: { id: true, name: true } },
      saleItem: { select: { id: true, name: true, total: true } },
      rule: { select: { id: true, name: true, type: true, rate: true } },
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
  });
}

export async function createCommissionRule(
  tenantId: string,
  input: {
    name: string;
    type: "PERCENTAGE" | "FIXED";
    rate: number | string;
    serviceId?: string | null;
    barberId?: string | null;
  }
) {
  return prisma.commissionRule.create({
    data: {
      tenantId,
      name: input.name.trim(),
      type: input.type,
      rate: toDecimal(input.rate),
      serviceId: input.serviceId ?? null,
      barberId: input.barberId ?? null,
      active: true,
    },
  });
}

export async function updateCommissionRule(
  tenantId: string,
  ruleId: string,
  input: {
    name: string;
    type: "PERCENTAGE" | "FIXED";
    rate: number | string;
    serviceId?: string | null;
    barberId?: string | null;
  }
) {
  return prisma.commissionRule.updateMany({
    where: { id: ruleId, tenantId },
    data: {
      name: input.name.trim(),
      type: input.type,
      rate: toDecimal(input.rate),
      serviceId: input.serviceId ?? null,
      barberId: input.barberId ?? null,
    },
  });
}

export async function toggleCommissionRule(
  tenantId: string,
  ruleId: string,
  active: boolean
) {
  return prisma.commissionRule.updateMany({
    where: { id: ruleId, tenantId },
    data: { active },
  });
}

export type SerializedCommissionEntry = {
  id: string;
  barberName: string;
  itemName: string;
  amount: number;
  periodKey: string;
  ruleName: string | null;
  createdAt: string;
};

export function serializeCommissionEntry(e: {
  id: string;
  amount: { toString(): string };
  periodKey: string;
  createdAt: Date;
  barber: { name: string };
  saleItem: { name: string } | null;
  rule: { name: string } | null;
}): SerializedCommissionEntry {
  return {
    id: e.id,
    barberName: e.barber.name,
    itemName: e.saleItem?.name ?? "—",
    amount: Number(e.amount),
    periodKey: e.periodKey,
    ruleName: e.rule?.name ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}
