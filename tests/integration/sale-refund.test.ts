import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import type { User } from "@prisma/client";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const required =
      process.env.CI === "true" || process.env.REQUIRE_DATABASE === "true";
    throw new Error(
      required
        ? "DATABASE_URL is required when CI=true or REQUIRE_DATABASE=true"
        : "DATABASE_URL is required for integration tests (P0). Set DATABASE_URL=postgresql://user:pass@localhost:5432/db"
    );
  }
  return url;
}

requireDatabaseUrl();

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser, type AuthenticatedUser } from "@/lib/authz";
import {
  createSale,
  addSaleItem,
  recordSalePaymentsAndClose,
  cancelSale,
  type SalesContext,
} from "@/lib/finance/sales";
import { openCashSession, calculateExpectedBalance } from "@/lib/finance/cash";
import { getReportMetrics } from "@/lib/reports/metrics";
import {
  createTenant,
  createUser,
  createService,
  createClient,
  createProduct,
  resetDatabase,
} from "../factories";

const mockGetServerSession = vi.mocked(getServerSession);

function mockSession(user: Pick<User, "id" | "email" | "name" | "role" | "tenantId">) {
  mockGetServerSession.mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as never);
}

async function asAuthenticatedUser(
  user: User
): Promise<AuthenticatedUser & { tenantId: string }> {
  mockSession(user);
  const authUser = await requireAuthenticatedUser();
  if (!authUser.tenantId) {
    throw new Error("Expected tenant-bound user for sales context");
  }
  return authUser as AuthenticatedUser & { tenantId: string };
}

/** Creates a tenant, opens cash, sells one service + N units of a product and closes via CASH. */
async function setupClosedSale(slug: string, opts?: { productQty?: number }) {
  const tenant = await createTenant(prisma, { slug });
  const owner = await createUser(prisma, { tenantId: tenant.id, role: "OWNER" });
  const barber = await createUser(prisma, { tenantId: tenant.id, role: "BARBER" });
  const service = await createService(prisma, tenant.id, { price: "100.00" });
  const product = await createProduct(prisma, tenant.id, { price: "20.00", stockQty: 10 });
  const client = await createClient(prisma, tenant.id);
  const ctx: SalesContext = { user: await asAuthenticatedUser(owner) };

  await prisma.commissionRule.create({
    data: {
      tenantId: tenant.id,
      name: "Barber 10%",
      type: "PERCENTAGE",
      rate: new Decimal("10"),
      barberId: barber.id,
      serviceId: service.id,
      active: true,
    },
  });

  await openCashSession(ctx, { openingBalance: "0" });

  const sale = await createSale(ctx, { clientId: client.id });
  const serviceItem = await addSaleItem(ctx, sale.id, {
    kind: "SERVICE",
    serviceId: service.id,
    barberId: barber.id,
  });
  const qty = opts?.productQty ?? 2;
  const productItem = await addSaleItem(ctx, sale.id, {
    kind: "PRODUCT",
    productId: product.id,
    quantity: qty,
  });

  const total = 100 + 20 * qty;
  const closed = await recordSalePaymentsAndClose(ctx, sale.id, {
    payments: [{ method: "CASH", amount: total }],
    idempotencyKey: `close-${sale.id}`,
  });

  return { tenant, owner, barber, service, product, client, ctx, sale: closed, serviceItem, productItem, total };
}

describe("sale refund & cancellation integrity (PostgreSQL)", () => {
  beforeAll(async () => { vi.clearAllMocks(); await resetDatabase(prisma); }); beforeEach(() => { vi.clearAllMocks(); });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("case 12: cancelSale returns product stock exactly once", async () => {
    const { ctx, sale, product, productItem } = await setupClosedSale("refund-stock-once");

    const beforeCancel = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(beforeCancel.stockQty).toBe(8); // 10 - 2 consumed on close

    await cancelSale(ctx, sale.id);

    const afterCancel = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(afterCancel.stockQty).toBe(10);

    const returnMovements = await prisma.stockMovement.count({
      where: { saleItemId: productItem.id, type: "RETURN" },
    });
    expect(returnMovements).toBe(1);
  });

  it("case 13: cancelSale creates exactly one SaleRefund per completed payment", async () => {
    const { ctx, sale } = await setupClosedSale("refund-once");
    expect(sale.payments).toHaveLength(1);

    await cancelSale(ctx, sale.id);

    const refunds = await prisma.saleRefund.count({ where: { saleId: sale.id } });
    expect(refunds).toBe(1);

    const payment = await prisma.salePayment.findFirstOrThrow({ where: { saleId: sale.id } });
    expect(payment.status).toBe("REFUNDED");
  });

  it("case 14: cancelSale creates a cash REFUND movement for the refunded cash total", async () => {
    const { ctx, sale, total } = await setupClosedSale("refund-cash-movement");

    await cancelSale(ctx, sale.id);

    const refundMovement = await prisma.cashMovement.findFirst({
      where: { idempotencyKey: `sale-refund-cash:${sale.id}` },
    });
    expect(refundMovement).not.toBeNull();
    expect(refundMovement?.type).toBe("REFUND");
    expect(Number(refundMovement?.amount)).toBe(total);
  });

  it("case 15: calculateExpectedBalance subtracts REFUND movements from the balance", () => {
    const balance = calculateExpectedBalance("0", [
      { type: "SALE", amount: "140" },
      { type: "REFUND", amount: "140" },
    ]);
    expect(balance.toString()).toBe("0");

    const balanceOnlyRefund = calculateExpectedBalance("100", [
      { type: "REFUND", amount: "30" },
    ]);
    expect(balanceOnlyRefund.toString()).toBe("70");

    const balanceOnlyBleed = calculateExpectedBalance("100", [
      { type: "BLEED", amount: "10" },
    ]);
    expect(balanceOnlyBleed.toString()).toBe("90");

    const balancePositives = calculateExpectedBalance("0", [
      { type: "SUPPLY", amount: "50" },
      { type: "ADJUSTMENT", amount: "5" },
    ]);
    expect(balancePositives.toString()).toBe("55");
  });

  it("case 16: cancelSale reverses commission — EARNED + REVERSAL nets to zero", async () => {
    const { ctx, sale, serviceItem } = await setupClosedSale("refund-commission-reversal");

    const earnedBefore = await prisma.commissionEntry.findMany({
      where: { saleItemId: serviceItem.id },
    });
    expect(earnedBefore).toHaveLength(1);
    expect(earnedBefore[0]?.kind).toBe("EARNED");

    await cancelSale(ctx, sale.id);

    const entries = await prisma.commissionEntry.findMany({
      where: { saleItemId: serviceItem.id },
    });
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.kind).sort()).toEqual(["EARNED", "REVERSAL"]);

    const net = entries.reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
    expect(net.toString()).toBe("0");
  });

  it("case 17: report metrics net revenue subtracts the refund in the same period", async () => {
    const { ctx, sale, tenant, total } = await setupClosedSale("refund-metrics-net");

    const before = await getReportMetrics(tenant.id, "30d");
    expect(before.revenue.total).toBe(total);

    await cancelSale(ctx, sale.id);

    const after = await getReportMetrics(tenant.id, "30d");
    expect(after.revenue.total).toBe(0);
  });

  it("case 18: cancelSale is idempotent on repeated calls", async () => {
    const { ctx, sale, product } = await setupClosedSale("refund-idempotent-cancel");

    const first = await cancelSale(ctx, sale.id);
    const second = await cancelSale(ctx, sale.id);

    expect(first.status).toBe("CANCELLED");
    expect(second.status).toBe("CANCELLED");
    expect(second.id).toBe(first.id);

    const stockAfter = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(stockAfter.stockQty).toBe(10);

    expect(await prisma.saleRefund.count({ where: { saleId: sale.id } })).toBe(1);
    expect(
      await prisma.cashMovement.count({
        where: { idempotencyKey: `sale-refund-cash:${sale.id}` },
      })
    ).toBe(1);
    expect(
      await prisma.stockMovement.count({ where: { productId: product.id, type: "RETURN" } })
    ).toBe(1);
  });
});
