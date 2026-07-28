import {
  Prisma,
  PrismaClient,
  type Role,
  type MembershipBilling,
  type MembershipPlanType,
  type MembershipStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { Decimal } from "@prisma/client/runtime/library";
import { openCashSession } from "@/lib/finance/cash";
import type { AuthenticatedUser } from "@/lib/authz";

export function createPrisma() {
  return new PrismaClient();
}

/**
 * Test setup runs against a real, remote Postgres instance and occasionally
 * hits transient errors (deadlocks from TRUNCATE lock contention, or brief
 * FK-visibility hiccups right after a dependent row is created) that have
 * nothing to do with the behavior under test. Retry a handful of times
 * before giving up so a flaky connection doesn't fail an otherwise-correct
 * test.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isDeadlock =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "40001";
      const isTransientPg =
        err instanceof Prisma.PrismaClientUnknownRequestError ||
        err instanceof Prisma.PrismaClientKnownRequestError;
      const message = err instanceof Error ? err.message : String(err);
      const isRetryable =
        isDeadlock ||
        message.includes("40P01") ||
        message.includes("deadlock detected") ||
        message.includes("Foreign key constraint violated") ||
        (isTransientPg && message.includes("Response from the Engine was empty"));
      if (!isRetryable || attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function resetDatabase(prisma: PrismaClient) {
  await withRetry(async () => {
    // Order matters for FKs — truncate all public tables
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    if (tables.length === 0) return;
    const list = tables.map((t) => `"${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
  });
}

export async function createTenant(
  prisma: PrismaClient,
  opts?: { name?: string; slug?: string }
) {
  const slug = opts?.slug ?? `shop-${Math.random().toString(36).slice(2, 8)}`;
  return withRetry(() =>
    prisma.tenant.create({
      data: {
        name: opts?.name ?? `Barbearia ${slug}`,
        slug,
        plan: "PRO",
        active: true,
        settings: {
          create: {
            openTime: "09:00",
            closeTime: "18:00",
            workingDays: "1,2,3,4,5",
            publicBookingEnabled: true,
            timeZone: "America/Sao_Paulo",
          },
        },
      },
    })
  );
}

export async function createUser(
  prisma: PrismaClient,
  opts: {
    tenantId: string | null;
    role: Role;
    email?: string;
    active?: boolean;
    name?: string;
  }
) {
  const email =
    opts.email ??
    `${opts.role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  const passwordHash = await bcrypt.hash("password123", 4);
  return withRetry(() =>
    prisma.user.create({
      data: {
        email,
        name: opts.name ?? email.split("@")[0],
        passwordHash,
        role: opts.role,
        active: opts.active ?? true,
        tenantId: opts.tenantId,
      },
    })
  );
}

export async function createService(
  prisma: PrismaClient,
  tenantId: string,
  opts?: { name?: string; price?: string; duration?: number }
) {
  return withRetry(() =>
    prisma.service.create({
      data: {
        tenantId,
        name: opts?.name ?? "Corte",
        price: new Decimal(opts?.price ?? "50.00"),
        duration: opts?.duration ?? 30,
        active: true,
      },
    })
  );
}

export async function createClient(
  prisma: PrismaClient,
  tenantId: string,
  opts?: { name?: string; phone?: string }
) {
  const phone =
    opts?.phone ??
    `119${Math.floor(10000000 + Math.random() * 89999999)}`;
  return withRetry(() =>
    prisma.client.create({
      data: {
        tenantId,
        name: opts?.name ?? "Cliente Teste",
        phone,
      },
    })
  );
}

/** Creates a product with an initial IN stock movement so derived stockQty stays consistent. */
export async function createProduct(
  prisma: PrismaClient,
  tenantId: string,
  opts?: { name?: string; price?: string; stockQty?: number; sku?: string | null }
) {
  const stockQty = opts?.stockQty ?? 10;
  const product = await withRetry(() =>
    prisma.product.create({
      data: {
        tenantId,
        name: opts?.name ?? "Produto Teste",
        sku: opts?.sku ?? null,
        price: new Decimal(opts?.price ?? "30.00"),
        stockQty,
        active: true,
      },
    })
  );

  if (stockQty > 0) {
    await withRetry(() =>
      prisma.stockMovement.create({
        data: {
          tenantId,
          productId: product.id,
          type: "IN",
          quantity: stockQty,
          notes: "Estoque inicial teste",
        },
      })
    );
  }

  return product;
}

/** Thin wrapper around the real openCashSession action, for tests that need a live open drawer. */
export async function createOpenCash(
  ctx: { user: AuthenticatedUser & { tenantId: string } },
  opts?: { openingBalance?: string; locationId?: string | null }
) {
  return withRetry(() =>
    openCashSession(ctx, {
      openingBalance: opts?.openingBalance ?? "0",
      locationId: opts?.locationId ?? null,
    })
  );
}

export async function createMembershipPlan(
  prisma: PrismaClient,
  tenantId: string,
  opts?: {
    name?: string;
    price?: string;
    planType?: MembershipPlanType;
    maxVisitsPerMonth?: number | null;
    totalVisits?: number | null;
    billingCycle?: MembershipBilling;
    allowedWeekdays?: string;
  }
) {
  return withRetry(() =>
    prisma.membershipPlan.create({
      data: {
        tenantId,
        name: opts?.name ?? "Plano Teste",
        price: new Decimal(opts?.price ?? "100.00"),
        billingCycle: opts?.billingCycle ?? "MONTHLY",
        planType: opts?.planType ?? "MONTHLY_LIMITED",
        maxVisitsPerMonth:
          opts?.maxVisitsPerMonth === undefined ? 1 : opts.maxVisitsPerMonth,
        totalVisits: opts?.totalVisits ?? null,
        allowedWeekdays: opts?.allowedWeekdays ?? "0,1,2,3,4,5,6",
      },
    })
  );
}

export async function createMembership(
  prisma: PrismaClient,
  tenantId: string,
  clientId: string,
  planId: string,
  opts?: {
    status?: MembershipStatus;
    visitsUsedThisPeriod?: number;
    expiresAt?: Date | null;
  }
) {
  return withRetry(() =>
    prisma.clientMembership.create({
      data: {
        tenantId,
        clientId,
        planId,
        status: opts?.status ?? "ACTIVE",
        visitsUsedThisPeriod: opts?.visitsUsedThisPeriod ?? 0,
        expiresAt: opts?.expiresAt ?? null,
      },
    })
  );
}
