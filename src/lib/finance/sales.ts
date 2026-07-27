import "server-only";
import { Decimal } from "@prisma/client/runtime/library";
import type { PaymentMethod, SaleItemKind, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertTenantResource,
  hasPermission,
  type AuthenticatedUser,
} from "@/lib/authz";
import { createCommissionEntryForSaleItem } from "@/lib/commissions/engine";
import { ensurePrimaryLocation } from "@/lib/finance/cash";
import { recordStockMovement } from "@/lib/inventory/products";
import { getTenantTimezone } from "@/lib/timezone";

export type SalesContext = {
  user: AuthenticatedUser & { tenantId: string };
};

function toDecimal(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/**
 * Revenue is recorded only through Sale (comanda). Completing an appointment
 * updates visit/membership state only — it does NOT create revenue or cash
 * movements. Always open a comanda (or link one) to register barbershop income.
 */

async function recalculateSaleTotals(saleId: string) {
  const items = await prisma.saleItem.findMany({ where: { saleId } });
  const subtotal = items.reduce(
    (sum, item) => sum.plus(toDecimal(item.total)),
    new Decimal(0)
  );

  const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
  const discount = toDecimal(sale.discount);
  const surcharge = toDecimal(sale.surcharge);
  const tip = toDecimal(sale.tip);
  const total = subtotal.minus(discount).plus(surcharge).plus(tip);

  return prisma.sale.update({
    where: { id: saleId },
    data: {
      subtotal,
      total: total.lt(0) ? new Decimal(0) : total,
    },
  });
}

async function getTenantTimeZone(tenantId: string) {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { timeZone: true },
  });
  return getTenantTimezone(settings?.timeZone);
}

export async function createSale(
  ctx: SalesContext,
  input: {
    clientId?: string | null;
    appointmentId?: string | null;
    locationId?: string | null;
    cashSessionId?: string | null;
    notes?: string | null;
  }
) {
  const { user } = ctx;
  if (!hasPermission(user, "finance:sell")) {
    throw new Error("Sem permissão para registrar vendas");
  }

  let locationId = input.locationId ?? null;
  if (!locationId) {
    const primary = await ensurePrimaryLocation(user.tenantId);
    locationId = primary.id;
  }

  if (input.appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, tenantId: user.tenantId },
    });
    if (!appt) throw new Error("Agendamento não encontrado");
    if (!input.clientId) input.clientId = appt.clientId;
  }

  if (input.cashSessionId) {
    const session = await prisma.cashSession.findFirst({
      where: {
        id: input.cashSessionId,
        tenantId: user.tenantId,
        status: "OPEN",
      },
    });
    if (!session) throw new Error("Caixa aberto não encontrado");
  }

  return prisma.sale.create({
    data: {
      tenantId: user.tenantId,
      status: "OPEN",
      clientId: input.clientId ?? null,
      appointmentId: input.appointmentId ?? null,
      locationId,
      cashSessionId: input.cashSessionId ?? null,
      operatorUserId: user.id,
      notes: input.notes ?? null,
    },
    include: {
      client: { select: { id: true, name: true } },
      items: true,
      payments: true,
    },
  });
}

export async function linkAppointment(
  ctx: SalesContext,
  saleId: string,
  appointmentId: string
) {
  const { user } = ctx;
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId: user.tenantId },
  });
  if (!sale) throw new Error("Comanda não encontrada");
  if (sale.status === "CANCELLED" || sale.status === "CLOSED") {
    throw new Error("Comanda não pode ser alterada");
  }

  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId: user.tenantId },
  });
  if (!appt) throw new Error("Agendamento não encontrado");

  return prisma.sale.update({
    where: { id: saleId },
    data: {
      appointmentId,
      clientId: sale.clientId ?? appt.clientId,
    },
  });
}

export async function addSaleItem(
  ctx: SalesContext,
  saleId: string,
  input: {
    kind: SaleItemKind;
    serviceId?: string | null;
    productId?: string | null;
    barberId?: string | null;
    appointmentId?: string | null;
    name?: string | null;
    quantity?: number;
    unitPrice?: number | string | null;
    discount?: number | string | null;
  }
) {
  const { user } = ctx;
  if (!hasPermission(user, "finance:sell")) {
    throw new Error("Sem permissão para registrar vendas");
  }

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId: user.tenantId },
  });
  if (!sale) throw new Error("Comanda não encontrada");
  assertTenantResource(user, sale.tenantId);
  if (sale.status === "CANCELLED" || sale.status === "CLOSED") {
    throw new Error("Comanda não pode ser alterada");
  }

  const quantity = input.quantity ?? 1;
  if (quantity <= 0) throw new Error("Quantidade inválida");

  let name = input.name?.trim() ?? "";
  let unitPrice = input.unitPrice != null ? toDecimal(input.unitPrice) : null;
  const serviceId = input.serviceId ?? null;
  const productId = input.productId ?? null;
  const barberId = input.barberId ?? null;

  if (input.kind === "SERVICE") {
    if (!serviceId) throw new Error("Serviço obrigatório");
    const service = await prisma.service.findFirst({
      where: { id: serviceId, tenantId: user.tenantId, active: true },
    });
    if (!service) throw new Error("Serviço não encontrado");
    name = name || service.name;
    unitPrice = unitPrice ?? toDecimal(service.price);
  } else {
    if (!productId) throw new Error("Produto obrigatório");
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: user.tenantId, active: true },
    });
    if (!product) throw new Error("Produto não encontrado");
    name = name || product.name;
    unitPrice = unitPrice ?? toDecimal(product.price);
    if (product.stockQty < quantity) {
      throw new Error(`Estoque insuficiente (${product.stockQty} disponível)`);
    }
  }

  const discount = toDecimal(input.discount ?? 0);
  const lineTotal = unitPrice!.mul(quantity).minus(discount);

  const item = await prisma.saleItem.create({
    data: {
      tenantId: user.tenantId,
      saleId,
      kind: input.kind,
      serviceId,
      productId,
      barberId,
      appointmentId: input.appointmentId ?? sale.appointmentId,
      name,
      quantity,
      unitPrice: unitPrice!,
      discount,
      total: lineTotal.lt(0) ? new Decimal(0) : lineTotal,
    },
  });

  if (input.kind === "PRODUCT" && productId) {
    await recordStockMovement(ctx, {
      productId,
      type: "SALE",
      quantity,
      saleItemId: item.id,
      notes: `Venda ${saleId.slice(-6)}`,
    });
  }

  await recalculateSaleTotals(saleId);
  return item;
}

async function tryCloseSale(ctx: SalesContext, saleId: string) {
  const sale = await prisma.sale.findUniqueOrThrow({
    where: { id: saleId },
    include: { items: true, payments: true },
  });

  if (sale.status !== "OPEN" && sale.status !== "DRAFT") return sale;
  if (sale.items.length === 0) return sale;

  const paid = sale.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum.plus(toDecimal(p.amount)), new Decimal(0));

  if (paid.lt(toDecimal(sale.total))) return sale;

  const closed = await prisma.sale.update({
    where: { id: saleId },
    data: { status: "CLOSED" satisfies SaleStatus, closedAt: new Date() },
    include: { items: true, payments: true },
  });

  const tz = await getTenantTimeZone(ctx.user.tenantId);
  for (const item of closed.items) {
    await createCommissionEntryForSaleItem(ctx.user.tenantId, item.id, tz);
  }

  const cashPayment = closed.payments.find(
    (p) => p.method === "CASH" && p.status === "COMPLETED"
  );
  if (cashPayment && closed.cashSessionId) {
    const session = await prisma.cashSession.findFirst({
      where: { id: closed.cashSessionId, status: "OPEN" },
    });
    if (session) {
      await prisma.cashMovement.create({
        data: {
          tenantId: ctx.user.tenantId,
          sessionId: session.id,
          type: "SALE",
          amount: cashPayment.amount,
          notes: `Comanda ${saleId.slice(-6)}`,
          createdByUserId: ctx.user.id,
        },
      });
    }
  }

  return closed;
}

export async function addSalePayment(
  ctx: SalesContext,
  saleId: string,
  input: {
    method: PaymentMethod;
    amount: number | string;
    status?: "PENDING" | "COMPLETED";
  }
) {
  const { user } = ctx;
  if (!hasPermission(user, "finance:sell")) {
    throw new Error("Sem permissão para registrar pagamentos");
  }

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId: user.tenantId },
  });
  if (!sale) throw new Error("Comanda não encontrada");
  if (sale.status === "CANCELLED" || sale.status === "CLOSED") {
    throw new Error("Comanda não pode receber pagamentos");
  }

  const amount = toDecimal(input.amount);
  if (amount.lte(0)) throw new Error("Valor deve ser positivo");

  const payment = await prisma.salePayment.create({
    data: {
      tenantId: user.tenantId,
      saleId,
      method: input.method,
      amount,
      status: input.status ?? "COMPLETED",
      source: input.status === "PENDING" ? "PENDING" : "PAID_MANUAL",
    },
  });

  await tryCloseSale(ctx, saleId);
  return payment;
}

export async function cancelSale(
  ctx: SalesContext,
  saleId: string,
  input?: { reason?: string | null }
) {
  const { user } = ctx;
  if (!hasPermission(user, "finance:refund") && !hasPermission(user, "finance:sell")) {
    throw new Error("Sem permissão para cancelar comanda");
  }

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId: user.tenantId },
    include: { items: true },
  });
  if (!sale) throw new Error("Comanda não encontrada");
  if (sale.status === "CANCELLED") return sale;

  for (const item of sale.items) {
    if (item.kind === "PRODUCT" && item.productId) {
      await recordStockMovement(ctx, {
        productId: item.productId,
        type: "RETURN",
        quantity: item.quantity,
        saleItemId: item.id,
        notes: input?.reason ?? "Cancelamento de comanda",
      });
    }
  }

  return prisma.sale.update({
    where: { id: saleId },
    data: {
      status: "CANCELLED",
      notes: input?.reason
        ? sale.notes
          ? `${sale.notes}\nCancelada: ${input.reason}`
          : `Cancelada: ${input.reason}`
        : sale.notes,
    },
  });
}

export async function listSales(
  tenantId: string,
  opts?: { status?: SaleStatus; limit?: number; todayOnly?: boolean; timeZone?: string }
) {
  const where: {
    tenantId: string;
    status?: SaleStatus;
    createdAt?: { gte: Date; lt: Date };
  } = {
    tenantId,
    ...(opts?.status ? { status: opts.status } : {}),
  };

  if (opts?.todayOnly && opts.timeZone) {
    const { startOfZonedDay, endOfZonedDay } = await import("@/lib/timezone");
    const now = new Date();
    where.createdAt = {
      gte: startOfZonedDay(now, opts.timeZone),
      lt: endOfZonedDay(now, opts.timeZone),
    };
  }

  return prisma.sale.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      operatorUser: { select: { id: true, name: true } },
      items: { select: { id: true, name: true, total: true, quantity: true } },
      payments: { select: { id: true, method: true, amount: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 30,
  });
}

export async function getSaleById(tenantId: string, saleId: string) {
  return prisma.sale.findFirst({
    where: { id: saleId, tenantId },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      appointment: { select: { id: true, scheduledAt: true } },
      items: {
        include: {
          barber: { select: { id: true, name: true } },
        },
      },
      payments: true,
    },
  });
}

export async function getTodaySalesTotal(tenantId: string, timeZone: string) {
  const { startOfZonedDay, endOfZonedDay } = await import("@/lib/timezone");
  const now = new Date();
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      status: "CLOSED",
      closedAt: {
        gte: startOfZonedDay(now, timeZone),
        lt: endOfZonedDay(now, timeZone),
      },
    },
    select: { total: true },
  });

  return sales.reduce((sum, s) => sum.plus(toDecimal(s.total)), new Decimal(0));
}

export type SerializedSale = {
  id: string;
  status: SaleStatus;
  clientName: string | null;
  operatorName: string;
  subtotal: number;
  total: number;
  itemCount: number;
  createdAt: string;
  closedAt: string | null;
};

export function serializeSale(s: {
  id: string;
  status: SaleStatus;
  subtotal: { toString(): string };
  total: { toString(): string };
  createdAt: Date;
  closedAt: Date | null;
  client?: { name: string } | null;
  operatorUser?: { name: string } | null;
  items?: { id: string }[];
}): SerializedSale {
  return {
    id: s.id,
    status: s.status,
    clientName: s.client?.name ?? null,
    operatorName: s.operatorUser?.name ?? "—",
    subtotal: Number(s.subtotal),
    total: Number(s.total),
    itemCount: s.items?.length ?? 0,
    createdAt: s.createdAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
  };
}
