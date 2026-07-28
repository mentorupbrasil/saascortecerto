import "server-only";
import { createHash, randomUUID } from "crypto";
import { Decimal } from "@prisma/client/runtime/library";
import {
  Prisma,
  type PaymentMethod,
  type Role,
  type SaleItemKind,
  type SaleStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertTenantResource,
  hasPermission,
  type AuthenticatedUser,
} from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import {
  createCommissionEntryForSaleItem,
  reverseCommissionForSaleItem,
} from "@/lib/commissions/engine";
import { addCashMovement, ensurePrimaryLocation } from "@/lib/finance/cash";
import { recordStockMovement } from "@/lib/inventory/products";
import { getTenantTimezone } from "@/lib/timezone";

export type SalesContext = {
  user: AuthenticatedUser & { tenantId: string };
};

// Sale close/cancel transactions touch several tables (payments, commissions,
// stock, cash) across multiple round trips. Prisma's 5s default interactive
// transaction timeout is too tight under real network latency, so give these
// more headroom.
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 30_000 };

const SERVICE_CAPABLE_ROLES: Role[] = ["OWNER", "MANAGER", "BARBER"];

function toDecimal(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Stock strategy: consume inventory only when a sale is CLOSED, not when adding
 * a product to an open comanda. On add we only verify stockQty >= quantity
 * (reservation check); the actual SALE stock movement runs inside the payment
 * transaction that closes the sale.
 *
 * Revenue is recorded only through Sale (comanda). Completing an appointment
 * updates visit/membership state only — it does NOT create revenue or cash
 * movements. Always open a comanda (or link one) to register barbershop income.
 */

/** Rejects amounts that are not finite, not positive, or have more than 2 decimal places. */
export function assertExactMoneyAmount(value: number | string | Decimal): Decimal {
  let amount: Decimal;
  try {
    amount = toDecimal(value);
  } catch {
    throw new Error("Valor inválido");
  }
  if (amount.isNaN() || !amount.isFinite()) {
    throw new Error("Valor inválido");
  }
  if (amount.lte(0)) {
    throw new Error("Valor deve ser positivo");
  }
  if (amount.decimalPlaces() > 2) {
    throw new Error("Valor deve ter no máximo 2 casas decimais");
  }
  return amount;
}

/** Stable sha256 hash of a sale's payment batch payload — used for idempotency-key reuse detection. */
export function hashPaymentPayload(
  saleId: string,
  payments: Array<{ method: PaymentMethod; amount: number | string | Decimal }>
): string {
  const normalized = payments
    .map((p) => `${p.method}:${toDecimal(p.amount).toFixed(2)}`)
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ saleId, payments: normalized }))
    .digest("hex");
}

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

async function assertBarberCanServe(tenantId: string, barberId: string) {
  const barber = await prisma.user.findFirst({
    where: { id: barberId, tenantId, active: true },
    select: { id: true, role: true },
  });
  if (!barber) throw new Error("Profissional não encontrado");
  if (!SERVICE_CAPABLE_ROLES.includes(barber.role)) {
    throw new Error("Profissional selecionado não pode atender serviços");
  }
  return barber;
}

export async function createSale(
  ctx: SalesContext,
  input: {
    clientId?: string | null;
    appointmentId?: string | null;
    locationId?: string | null;
    cashSessionId?: string | null;
    defaultBarberId?: string | null;
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

  let defaultBarberId: string | null = null;
  if (input.defaultBarberId) {
    const barber = await assertBarberCanServe(user.tenantId, input.defaultBarberId);
    defaultBarberId = barber.id;
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
      defaultBarberId,
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

  const canDiscount = hasPermission(user, "finance:discount");
  if (input.unitPrice != null && !canDiscount) {
    throw new Error("Sem permissão para alterar preço");
  }

  const discount = toDecimal(input.discount ?? 0);
  if (discount.gt(0) && !canDiscount) {
    throw new Error("Sem permissão para aplicar desconto");
  }

  let name = input.name?.trim() ?? "";
  let catalogPrice: Decimal;
  const serviceId = input.serviceId ?? null;
  const productId = input.productId ?? null;
  let barberId = input.barberId ?? null;

  if (input.kind === "SERVICE") {
    if (!serviceId) throw new Error("Serviço obrigatório");
    const service = await prisma.service.findFirst({
      where: { id: serviceId, tenantId: user.tenantId, active: true },
    });
    if (!service) throw new Error("Serviço não encontrado");
    name = name || service.name;
    catalogPrice = toDecimal(service.price);
    if (!barberId && sale.defaultBarberId) {
      barberId = sale.defaultBarberId;
    }
  } else {
    if (!productId) throw new Error("Produto obrigatório");
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: user.tenantId, active: true },
    });
    if (!product) throw new Error("Produto não encontrado");
    name = name || product.name;
    catalogPrice = toDecimal(product.price);
    if (product.stockQty < quantity) {
      throw new Error(`Estoque insuficiente (${product.stockQty} disponível)`);
    }
  }

  const unitPrice =
    input.unitPrice != null ? toDecimal(input.unitPrice) : catalogPrice;

  if (input.unitPrice != null && !unitPrice.eq(catalogPrice)) {
    await writeAuditLog({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "sale.price_override",
      entityType: "Sale",
      entityId: saleId,
      metadata: {
        kind: input.kind,
        serviceId,
        productId,
        catalogPrice: catalogPrice.toString(),
        unitPrice: unitPrice.toString(),
      },
    });
  }

  const lineTotal = unitPrice.mul(quantity).minus(discount);

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
      unitPrice,
      discount,
      total: lineTotal.lt(0) ? new Decimal(0) : lineTotal,
    },
  });

  await recalculateSaleTotals(saleId);
  return item;
}

/**
 * Records one or more payments for a sale and, since the batch must always cover
 * the exact outstanding balance, closes the sale atomically in the same transaction.
 * Idempotent per (tenantId, idempotencyKey): replaying the same key with the same
 * payload returns the existing result; replaying with a different payload throws.
 */
export async function recordSalePaymentsAndClose(
  ctx: SalesContext,
  saleId: string,
  input: {
    payments: Array<{ method: PaymentMethod; amount: number | string }>;
    idempotencyKey: string;
  }
) {
  const { user } = ctx;
  if (!hasPermission(user, "finance:sell")) {
    throw new Error("Sem permissão para registrar pagamentos");
  }

  const idempotencyKey = input.idempotencyKey?.trim();
  if (!idempotencyKey) throw new Error("Chave de idempotência obrigatória");
  if (!input.payments.length) throw new Error("Informe ao menos um pagamento");

  const validatedPayments = input.payments.map((p) => ({
    method: p.method,
    amount: assertExactMoneyAmount(p.amount),
  }));

  const payloadHash = hashPaymentPayload(saleId, validatedPayments);
  const tz = await getTenantTimeZone(user.tenantId);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Sale" WHERE id = ${saleId} AND "tenantId" = ${user.tenantId} FOR UPDATE`;

    const sale = await tx.sale.findFirst({
      where: { id: saleId, tenantId: user.tenantId },
      include: { items: true, payments: true },
    });
    if (!sale) throw new Error("Comanda não encontrada");

    const existingBatch = await tx.salePaymentBatch.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId: user.tenantId, idempotencyKey },
      },
    });
    if (existingBatch) {
      if (existingBatch.payloadHash !== payloadHash) {
        throw new Error("Chave de idempotência reutilizada com payload diferente");
      }
      return tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { items: true, payments: true },
      });
    }

    if (sale.status !== "OPEN" && sale.status !== "DRAFT") {
      throw new Error("Comanda não pode receber pagamentos");
    }
    if (sale.items.length === 0) throw new Error("Comanda sem itens");

    const paidCompleted = sale.payments
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum.plus(toDecimal(p.amount)), new Decimal(0));
    const remaining = toDecimal(sale.total).minus(paidCompleted);
    const newTotal = validatedPayments.reduce(
      (sum, p) => sum.plus(p.amount),
      new Decimal(0)
    );

    if (!newTotal.eq(remaining)) {
      throw new Error(
        `Valor dos pagamentos (${newTotal.toFixed(2)}) deve ser igual ao saldo restante (${remaining.toFixed(2)})`
      );
    }

    let cashSessionId = sale.cashSessionId;
    const hasCash = validatedPayments.some((p) => p.method === "CASH");
    if (hasCash) {
      // Always resolve the currently open drawer for the unit — even if the
      // comanda was opened before any cash session existed (or linked to a
      // now-closed session).
      const openSession = await tx.cashSession.findFirst({
        where: {
          tenantId: user.tenantId,
          status: "OPEN",
          ...(sale.locationId ? { locationId: sale.locationId } : {}),
        },
        orderBy: { openedAt: "desc" },
      });
      if (!openSession) {
        throw new Error("Caixa fechado. Abra o caixa para receber pagamento em dinheiro.");
      }
      cashSessionId = openSession.id;
    }

    const batch = await tx.salePaymentBatch.create({
      data: {
        tenantId: user.tenantId,
        saleId,
        idempotencyKey,
        payloadHash,
      },
    });

    for (const p of validatedPayments) {
      await tx.salePayment.create({
        data: {
          tenantId: user.tenantId,
          saleId,
          method: p.method,
          amount: p.amount,
          status: "COMPLETED",
          source: "PAID_MANUAL",
          batchId: batch.id,
        },
      });
    }

    if (cashSessionId && cashSessionId !== sale.cashSessionId) {
      await tx.sale.update({ where: { id: saleId }, data: { cashSessionId } });
    }

    const updated = await tx.sale.updateMany({
      where: { id: saleId, tenantId: user.tenantId, status: { in: ["OPEN", "DRAFT"] } },
      data: { status: "CLOSED" satisfies SaleStatus, closedAt: new Date() },
    });

    if (updated.count !== 1) {
      return tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { items: true, payments: true },
      });
    }

    const closed = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { items: true, payments: true },
    });

    for (const item of closed.items) {
      await createCommissionEntryForSaleItem(user.tenantId, item.id, tz, tx);
    }

    const allCashCompleted = closed.payments
      .filter((p) => p.method === "CASH" && p.status === "COMPLETED")
      .reduce((sum, p) => sum.plus(toDecimal(p.amount)), new Decimal(0));

    if (allCashCompleted.gt(0) && closed.cashSessionId) {
      const session = await tx.cashSession.findFirst({
        where: { id: closed.cashSessionId, status: "OPEN" },
      });
      if (session) {
        await addCashMovement(
          ctx,
          session.id,
          {
            type: "SALE",
            amount: allCashCompleted,
            notes: `Comanda ${saleId.slice(-6)}`,
            idempotencyKey: `sale-close-cash:${saleId}`,
          },
          tx
        );
      }
    }

    for (const item of closed.items) {
      if (item.kind === "PRODUCT" && item.productId) {
        await recordStockMovement(
          ctx,
          {
            productId: item.productId,
            type: "SALE",
            quantity: item.quantity,
            saleItemId: item.id,
            notes: `Venda ${saleId.slice(-6)}`,
            idempotencyKey: `sale-item-stock:${item.id}`,
          },
          tx
        );
      }
    }

    return closed;
  }, TRANSACTION_OPTIONS);
}

/**
 * Thin single-payment wrapper around recordSalePaymentsAndClose with a
 * generated idempotency key. Only succeeds when the amount exactly matches
 * the comanda's outstanding balance (see recordSalePaymentsAndClose).
 */
export async function addSalePayment(
  ctx: SalesContext,
  saleId: string,
  input: {
    method: PaymentMethod;
    amount: number | string;
  }
) {
  const closed = await recordSalePaymentsAndClose(ctx, saleId, {
    payments: [{ method: input.method, amount: input.amount }],
    idempotencyKey: randomUUID(),
  });
  return closed.payments[closed.payments.length - 1];
}

/** Kept for concurrency tests: closes a sale once its completed payments cover the total. */
export async function closeSale(ctx: SalesContext, saleId: string) {
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

  const tz = await getTenantTimeZone(ctx.user.tenantId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sale.updateMany({
      where: {
        id: saleId,
        tenantId: ctx.user.tenantId,
        status: { in: ["OPEN", "DRAFT"] },
      },
      data: { status: "CLOSED" satisfies SaleStatus, closedAt: new Date() },
    });

    if (updated.count !== 1) {
      return tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { items: true, payments: true },
      });
    }

    const closed = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { items: true, payments: true },
    });

    for (const item of closed.items) {
      await createCommissionEntryForSaleItem(ctx.user.tenantId, item.id, tz, tx);
    }

    const allCashCompleted = closed.payments
      .filter((p) => p.method === "CASH" && p.status === "COMPLETED")
      .reduce((sum, p) => sum.plus(toDecimal(p.amount)), new Decimal(0));

    if (allCashCompleted.gt(0) && closed.cashSessionId) {
      const session = await tx.cashSession.findFirst({
        where: { id: closed.cashSessionId, status: "OPEN" },
      });
      if (session) {
        await addCashMovement(
          ctx,
          session.id,
          {
            type: "SALE",
            amount: allCashCompleted,
            notes: `Comanda ${saleId.slice(-6)}`,
            idempotencyKey: `sale-close-cash:${saleId}`,
          },
          tx
        );
      }
    }

    for (const item of closed.items) {
      if (item.kind === "PRODUCT" && item.productId) {
        await recordStockMovement(
          ctx,
          {
            productId: item.productId,
            type: "SALE",
            quantity: item.quantity,
            saleItemId: item.id,
            notes: `Venda ${saleId.slice(-6)}`,
            idempotencyKey: `sale-item-stock:${item.id}`,
          },
          tx
        );
      }
    }

    return closed;
  }, TRANSACTION_OPTIONS);
}

export async function cancelSale(
  ctx: SalesContext,
  saleId: string,
  input?: { reason?: string | null }
) {
  const { user } = ctx;

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId: user.tenantId },
    include: { items: true, payments: true },
  });
  if (!sale) throw new Error("Comanda não encontrada");

  const hasCompletedPayments = sale.payments.some((p) => p.status === "COMPLETED");
  const isClosed = sale.status === "CLOSED";

  if (isClosed || hasCompletedPayments) {
    if (!hasPermission(user, "finance:refund")) {
      throw new Error("Sem permissão para estornar comanda paga");
    }
  } else if (
    !hasPermission(user, "finance:refund") &&
    !hasPermission(user, "finance:sell")
  ) {
    throw new Error("Sem permissão para cancelar comanda");
  }

  const tz = await getTenantTimeZone(user.tenantId);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Sale" WHERE id = ${saleId} AND "tenantId" = ${user.tenantId} FOR UPDATE`;

    const current = await tx.sale.findFirst({
      where: { id: saleId, tenantId: user.tenantId },
      include: { items: true, payments: true, refunds: true },
    });
    if (!current) throw new Error("Comanda não encontrada");

    if (current.status === "CANCELLED") {
      return current;
    }

    const wasClosed = current.status === "CLOSED";
    const completedPayments = current.payments.filter((p) => p.status === "COMPLETED");
    const hasCompletedPayments = completedPayments.length > 0;

    // Re-check permissions under the row lock — status/payments may have changed.
    if (wasClosed || hasCompletedPayments) {
      if (!hasPermission(user, "finance:refund")) {
        throw new Error("Sem permissão para estornar comanda paga");
      }
    } else if (
      !hasPermission(user, "finance:refund") &&
      !hasPermission(user, "finance:sell")
    ) {
      throw new Error("Sem permissão para cancelar comanda");
    }

    if (wasClosed) {
      for (const item of current.items) {
        if (item.kind === "PRODUCT" && item.productId) {
          await recordStockMovement(
            ctx,
            {
              productId: item.productId,
              type: "RETURN",
              quantity: item.quantity,
              saleItemId: item.id,
              notes: input?.reason ?? "Cancelamento de comanda",
              idempotencyKey: `sale-item-return:${item.id}`,
            },
            tx
          );
        }
      }
    }

    let refundedCash = new Decimal(0);
    for (const payment of completedPayments) {
      let refund = await tx.saleRefund.findUnique({ where: { paymentId: payment.id } });
      if (!refund) {
        try {
          refund = await tx.saleRefund.create({
            data: {
              tenantId: user.tenantId,
              saleId,
              paymentId: payment.id,
              amount: payment.amount,
              reason: input?.reason ?? null,
              refundedByUserId: user.id,
            },
          });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            refund = await tx.saleRefund.findUnique({ where: { paymentId: payment.id } });
          } else {
            throw err;
          }
        }
      }

      await tx.salePayment.updateMany({
        where: { id: payment.id, status: "COMPLETED" },
        data: { status: "REFUNDED" },
      });

      if (payment.method === "CASH") {
        refundedCash = refundedCash.plus(toDecimal(payment.amount));
      }
    }

    if (refundedCash.gt(0)) {
      const openSession = await tx.cashSession.findFirst({
        where: {
          tenantId: user.tenantId,
          status: "OPEN",
          ...(current.locationId ? { locationId: current.locationId } : {}),
        },
        orderBy: { openedAt: "desc" },
      });
      if (!openSession) {
        throw new Error("Caixa fechado. Abra o caixa para estornar pagamento em dinheiro.");
      }
      await addCashMovement(
        ctx,
        openSession.id,
        {
          type: "REFUND",
          amount: refundedCash,
          notes: `Estorno comanda ${saleId.slice(-6)}`,
          idempotencyKey: `sale-refund-cash:${saleId}`,
        },
        tx
      );
    }

    for (const item of current.items) {
      await reverseCommissionForSaleItem(user.tenantId, item.id, tz, tx);
    }

    return tx.sale.update({
      where: { id: saleId },
      data: {
        status: "CANCELLED",
        notes: input?.reason
          ? current.notes
            ? `${current.notes}\nCancelada: ${input.reason}`
            : `Cancelada: ${input.reason}`
          : current.notes,
      },
    });
  }, TRANSACTION_OPTIONS);
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

export async function getTodayNetRevenue(tenantId: string, timeZone: string) {
  const { startOfZonedDay, endOfZonedDay } = await import("@/lib/timezone");
  const now = new Date();
  const from = startOfZonedDay(now, timeZone);
  const to = endOfZonedDay(now, timeZone);

  const [payments, refunds] = await Promise.all([
    prisma.salePayment.findMany({
      where: {
        tenantId,
        status: { in: ["COMPLETED", "REFUNDED"] },
        createdAt: { gte: from, lt: to },
      },
      select: { amount: true },
    }),
    prisma.saleRefund.findMany({
      where: {
        tenantId,
        createdAt: { gte: from, lt: to },
      },
      select: { amount: true },
    }),
  ]);

  const gross = payments.reduce(
    (sum, p) => sum.plus(toDecimal(p.amount)),
    new Decimal(0)
  );
  const refunded = refunds.reduce(
    (sum, r) => sum.plus(toDecimal(r.amount)),
    new Decimal(0)
  );
  return gross.minus(refunded);
}

/** @deprecated Prefer getTodayNetRevenue — kept as alias for call sites mid-migration. */
export async function getTodaySalesTotal(tenantId: string, timeZone: string) {
  return getTodayNetRevenue(tenantId, timeZone);
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
