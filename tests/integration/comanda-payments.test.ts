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
  type SalesContext,
} from "@/lib/finance/sales";
import { openCashSession } from "@/lib/finance/cash";
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

async function setupTenant(slug: string) {
  const tenant = await createTenant(prisma, { slug });
  const owner = await createUser(prisma, { tenantId: tenant.id, role: "OWNER" });
  const barber = await createUser(prisma, { tenantId: tenant.id, role: "BARBER" });
  const service = await createService(prisma, tenant.id, { price: "100.00" });
  const product = await createProduct(prisma, tenant.id, { price: "50.00", stockQty: 10 });
  const client = await createClient(prisma, tenant.id);
  const ctx: SalesContext = { user: await asAuthenticatedUser(owner) };
  return { tenant, owner, barber, service, product, client, ctx };
}

describe("comanda payments integrity (PostgreSQL)", () => {
  beforeAll(async () => { vi.clearAllMocks(); await resetDatabase(prisma); }); beforeEach(() => { vi.clearAllMocks(); });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("case 1: two parcels are saved atomically via recordSalePaymentsAndClose", async () => {
    const { ctx, service } = await setupTenant("comanda-two-parcels");
    await openCashSession(ctx, { openingBalance: "0" });
    const sale = await createSale(ctx, {});
    await addSaleItem(ctx, sale.id, { kind: "SERVICE", serviceId: service.id });

    const closed = await recordSalePaymentsAndClose(ctx, sale.id, {
      payments: [
        { method: "CASH", amount: 40 },
        { method: "CARD", amount: 60 },
      ],
      idempotencyKey: "key-two-parcels",
    });

    expect(closed.status).toBe("CLOSED");
    expect(closed.payments).toHaveLength(2);
    const totalPaid = closed.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    expect(totalPaid).toBe(100);
  });

  it("case 2: an invalid payment (amount 0) in the batch saves none of the payments", async () => {
    const { ctx, service } = await setupTenant("comanda-invalid-batch");
    const sale = await createSale(ctx, {});
    await addSaleItem(ctx, sale.id, { kind: "SERVICE", serviceId: service.id });

    await expect(
      recordSalePaymentsAndClose(ctx, sale.id, {
        payments: [
          { method: "CASH", amount: 100 },
          { method: "CARD", amount: 0 },
        ],
        idempotencyKey: "key-invalid-batch",
      })
    ).rejects.toThrow("Valor deve ser positivo");

    expect(await prisma.salePayment.count({ where: { saleId: sale.id } })).toBe(0);
    const reloaded = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(reloaded.status).toBe("OPEN");
  });

  it("case 3: replaying the same idempotency key with the same payload doesn't duplicate", async () => {
    const { ctx, service } = await setupTenant("comanda-idem-same");
    await openCashSession(ctx, { openingBalance: "0" });
    const sale = await createSale(ctx, {});
    await addSaleItem(ctx, sale.id, { kind: "SERVICE", serviceId: service.id });

    const input = {
      payments: [{ method: "CASH" as const, amount: 100 }],
      idempotencyKey: "idem-key-replay",
    };

    const first = await recordSalePaymentsAndClose(ctx, sale.id, input);
    const second = await recordSalePaymentsAndClose(ctx, sale.id, input);

    expect(second.id).toBe(first.id);
    expect(await prisma.salePayment.count({ where: { saleId: sale.id } })).toBe(1);
    expect(await prisma.salePaymentBatch.count({ where: { saleId: sale.id } })).toBe(1);
  });

  it("case 4: reusing the same idempotency key with a different payload fails", async () => {
    const { ctx, service } = await setupTenant("comanda-idem-diff");
    await openCashSession(ctx, { openingBalance: "0" });
    const sale1 = await createSale(ctx, {});
    await addSaleItem(ctx, sale1.id, { kind: "SERVICE", serviceId: service.id });
    await recordSalePaymentsAndClose(ctx, sale1.id, {
      payments: [{ method: "CASH", amount: 100 }],
      idempotencyKey: "shared-key",
    });

    const sale2 = await createSale(ctx, {});
    await addSaleItem(ctx, sale2.id, { kind: "SERVICE", serviceId: service.id });

    await expect(
      recordSalePaymentsAndClose(ctx, sale2.id, {
        payments: [{ method: "CASH", amount: 100 }],
        idempotencyKey: "shared-key",
      })
    ).rejects.toThrow("Chave de idempotência reutilizada com payload diferente");

    const sale2Reloaded = await prisma.sale.findUniqueOrThrow({ where: { id: sale2.id } });
    expect(sale2Reloaded.status).toBe("OPEN");
    expect(await prisma.salePayment.count({ where: { saleId: sale2.id } })).toBe(0);
  });

  it("case 5: underpayment (less than outstanding balance) fails", async () => {
    const { ctx, service } = await setupTenant("comanda-underpay");
    const sale = await createSale(ctx, {});
    await addSaleItem(ctx, sale.id, { kind: "SERVICE", serviceId: service.id });

    await expect(
      recordSalePaymentsAndClose(ctx, sale.id, {
        payments: [{ method: "CASH", amount: 50 }],
        idempotencyKey: "underpay-key",
      })
    ).rejects.toThrow(/saldo restante/);

    const reloaded = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(reloaded.status).toBe("OPEN");
  });

  it("case 6: overpayment (more than outstanding balance) fails", async () => {
    const { ctx, service } = await setupTenant("comanda-overpay");
    const sale = await createSale(ctx, {});
    await addSaleItem(ctx, sale.id, { kind: "SERVICE", serviceId: service.id });

    await expect(
      recordSalePaymentsAndClose(ctx, sale.id, {
        payments: [{ method: "CASH", amount: 150 }],
        idempotencyKey: "overpay-key",
      })
    ).rejects.toThrow(/saldo restante/);

    const reloaded = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(reloaded.status).toBe("OPEN");
  });

  it("case 7: two CASH payments create exactly one summed CashMovement keyed by sale-close-cash:<saleId>", async () => {
    const { ctx, service } = await setupTenant("comanda-cash-sum");
    await openCashSession(ctx, { openingBalance: "0" });
    const sale = await createSale(ctx, {});
    await addSaleItem(ctx, sale.id, { kind: "SERVICE", serviceId: service.id });

    await recordSalePaymentsAndClose(ctx, sale.id, {
      payments: [
        { method: "CASH", amount: 60 },
        { method: "CASH", amount: 40 },
      ],
      idempotencyKey: "cash-sum-key",
    });

    const movements = await prisma.cashMovement.findMany({
      where: { idempotencyKey: `sale-close-cash:${sale.id}` },
    });
    expect(movements).toHaveLength(1);
    expect(Number(movements[0].amount)).toBe(100);
    expect(movements[0].type).toBe("SALE");
  });

  it("case 8: CASH payment without an open cash session fails", async () => {
    const { ctx, service } = await setupTenant("comanda-no-cash");
    const sale = await createSale(ctx, {});
    await addSaleItem(ctx, sale.id, { kind: "SERVICE", serviceId: service.id });

    await expect(
      recordSalePaymentsAndClose(ctx, sale.id, {
        payments: [{ method: "CASH", amount: 100 }],
        idempotencyKey: "no-cash-key",
      })
    ).rejects.toThrow(/Caixa fechado/);

    const reloaded = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(reloaded.status).toBe("OPEN");
    expect(await prisma.salePayment.count({ where: { saleId: sale.id } })).toBe(0);
  });

  it("case 9: sale created before cash is open links to the session opened later on CASH payment", async () => {
    const { ctx, service } = await setupTenant("comanda-late-cash");
    const sale = await createSale(ctx, {});
    expect(sale.cashSessionId).toBeNull();

    await addSaleItem(ctx, sale.id, { kind: "SERVICE", serviceId: service.id });
    const session = await openCashSession(ctx, { openingBalance: "0" });

    const closed = await recordSalePaymentsAndClose(ctx, sale.id, {
      payments: [{ method: "CASH", amount: 100 }],
      idempotencyKey: "late-cash-key",
    });

    expect(closed.cashSessionId).toBe(session.id);
  });

  it("case 10: defaultBarberId persists after createSale and reload", async () => {
    const { ctx, barber } = await setupTenant("comanda-default-barber");
    const sale = await createSale(ctx, { defaultBarberId: barber.id });
    expect(sale.defaultBarberId).toBe(barber.id);

    const reloaded = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(reloaded.defaultBarberId).toBe(barber.id);
  });

  it("case 11: concurrent recordSalePaymentsAndClose on the same sale closes/consumes stock/commission/cash exactly once", async () => {
    const { ctx, tenant, barber, service, product } = await setupTenant(
      "comanda-concurrent-close"
    );
    await openCashSession(ctx, { openingBalance: "0" });

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

    const sale = await createSale(ctx, {});
    const serviceItem = await addSaleItem(ctx, sale.id, {
      kind: "SERVICE",
      serviceId: service.id,
      barberId: barber.id,
    });
    const productItem = await addSaleItem(ctx, sale.id, {
      kind: "PRODUCT",
      productId: product.id,
      quantity: 2,
    });

    // total = 100 (service) + 50 * 2 (product) = 200
    const payments = [{ method: "CASH" as const, amount: 200 }];

    const results = await Promise.allSettled([
      recordSalePaymentsAndClose(ctx, sale.id, { payments, idempotencyKey: "concurrent-key-a" }),
      recordSalePaymentsAndClose(ctx, sale.id, { payments, idempotencyKey: "concurrent-key-b" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const closedSale = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(closedSale.status).toBe("CLOSED");

    expect(
      await prisma.commissionEntry.count({
        where: { saleItemId: serviceItem.id, kind: "EARNED" },
      })
    ).toBe(1);
    expect(
      await prisma.stockMovement.count({ where: { saleItemId: productItem.id, type: "SALE" } })
    ).toBe(1);
    expect(
      await prisma.cashMovement.count({ where: { tenantId: tenant.id, type: "SALE" } })
    ).toBe(1);
    expect(await prisma.salePayment.count({ where: { saleId: sale.id } })).toBe(1);

    const productReloaded = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(productReloaded.stockQty).toBe(8);
  });
});
