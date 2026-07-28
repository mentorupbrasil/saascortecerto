import "server-only";
import { Decimal } from "@prisma/client/runtime/library";
import {
  Prisma,
  type CashMovementType,
  type CashSession,
  type CashSessionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertTenantResource,
  hasPermission,
  type AuthenticatedUser,
} from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";

export type CashSessionContext = {
  user: AuthenticatedUser & { tenantId: string };
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function toDecimal(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Ensures a primary Location exists for legacy tenants without locations. */
export async function ensurePrimaryLocation(tenantId: string) {
  const existing = await prisma.location.findFirst({
    where: { tenantId, isPrimary: true, active: true },
  });
  if (existing) return existing;

  const anyLocation = await prisma.location.findFirst({
    where: { tenantId, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (anyLocation) {
    if (!anyLocation.isPrimary) {
      return prisma.location.update({
        where: { id: anyLocation.id },
        data: { isPrimary: true },
      });
    }
    return anyLocation;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, address: true, phone: true },
  });

  return prisma.location.create({
    data: {
      tenantId,
      name: tenant?.name ?? "Unidade principal",
      slug: "principal",
      address: tenant?.address,
      phone: tenant?.phone,
      isPrimary: true,
      active: true,
    },
  });
}

export async function getOpenCashSession(
  tenantId: string,
  locationId?: string | null
) {
  return prisma.cashSession.findFirst({
    where: {
      tenantId,
      status: "OPEN",
      ...(locationId ? { locationId } : {}),
    },
    include: {
      operatorUser: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      movements: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { openedAt: "desc" },
  });
}

export type CashSessionSummary = {
  openingBalance: Decimal;
  supply: Decimal;
  bleed: Decimal;
  sales: Decimal;
  refund: Decimal;
  adjustment: Decimal;
  expectedBalance: Decimal;
  movementCount: number;
};

/** Aggregates ALL movements of a session (not just the recent list). */
export async function getCashSessionSummary(
  sessionId: string,
  tenantId: string
): Promise<CashSessionSummary> {
  const session = await prisma.cashSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { openingBalance: true },
  });
  if (!session) throw new Error("Sessão de caixa não encontrada");

  const movements = await prisma.cashMovement.findMany({
    where: { sessionId, tenantId },
    select: { type: true, amount: true },
  });

  let supply = new Decimal(0);
  let bleed = new Decimal(0);
  let sales = new Decimal(0);
  let refund = new Decimal(0);
  let adjustment = new Decimal(0);

  for (const m of movements) {
    const amount = toDecimal(m.amount);
    switch (m.type) {
      case "SUPPLY":
        supply = supply.plus(amount);
        break;
      case "BLEED":
        bleed = bleed.plus(amount);
        break;
      case "SALE":
        sales = sales.plus(amount);
        break;
      case "REFUND":
        refund = refund.plus(amount);
        break;
      case "ADJUSTMENT":
        adjustment = adjustment.plus(amount);
        break;
      default:
        break;
    }
  }

  return {
    openingBalance: toDecimal(session.openingBalance),
    supply,
    bleed,
    sales,
    refund,
    adjustment,
    expectedBalance: calculateExpectedBalance(session.openingBalance, movements),
    movementCount: movements.length,
  };
}

export async function openCashSession(
  ctx: CashSessionContext,
  input: {
    openingBalance: number | string;
    locationId?: string | null;
    notes?: string | null;
  }
) {
  const { user } = ctx;
  if (!hasPermission(user, "finance:sell") && !hasPermission(user, "finance:cash_close")) {
    throw new Error("Sem permissão para abrir caixa");
  }

  const location = input.locationId
    ? await prisma.location.findFirst({
        where: { id: input.locationId, tenantId: user.tenantId, active: true },
      })
    : await ensurePrimaryLocation(user.tenantId);

  if (!location) throw new Error("Unidade não encontrada");

  const existingOpen = await prisma.cashSession.findFirst({
    where: {
      tenantId: user.tenantId,
      locationId: location.id,
      status: "OPEN",
    },
  });
  if (existingOpen) {
    throw new Error("Já existe um caixa aberto nesta unidade");
  }

  const session = await prisma.cashSession.create({
    data: {
      tenantId: user.tenantId,
      locationId: location.id,
      operatorUserId: user.id,
      status: "OPEN",
      openingBalance: toDecimal(input.openingBalance),
      notes: input.notes ?? null,
    },
    include: {
      operatorUser: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  });

  await writeAuditLog({
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: "cash.opened",
    entityType: "CashSession",
    entityId: session.id,
    metadata: { openingBalance: session.openingBalance.toString() },
  });

  return session;
}

/**
 * Balance convention: OPENING is the base; SUPPLY, SALE and ADJUSTMENT add to
 * the drawer (ADJUSTMENT is treated as a positive supply-like correction —
 * amounts are always stored positive); BLEED and REFUND subtract.
 */
export function calculateExpectedBalance(
  openingBalance: number | string | Decimal,
  movements: Array<{ type: CashMovementType; amount: number | string | Decimal }>
): Decimal {
  let balance = toDecimal(openingBalance);
  for (const m of movements) {
    const amount = toDecimal(m.amount);
    if (m.type === "BLEED" || m.type === "REFUND") {
      balance = balance.minus(amount);
    } else {
      balance = balance.plus(amount);
    }
  }
  return balance;
}

export async function computeExpectedBalance(sessionId: string): Promise<Decimal> {
  const session = await prisma.cashSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { movements: true },
  });

  return calculateExpectedBalance(session.openingBalance, session.movements);
}

export async function closeCashSession(
  ctx: CashSessionContext,
  sessionId: string,
  input: {
    closingBalance: number | string;
    notes?: string | null;
  }
) {
  const { user } = ctx;
  if (!hasPermission(user, "finance:cash_close")) {
    throw new Error("Sem permissão para fechar caixa");
  }

  const session = await prisma.cashSession.findFirst({
    where: { id: sessionId, tenantId: user.tenantId },
  });
  if (!session) throw new Error("Sessão de caixa não encontrada");
  assertTenantResource(user, session.tenantId);

  if (session.status === "CLOSED") {
    return prisma.cashSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        operatorUser: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        movements: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  const expectedBalance = await computeExpectedBalance(sessionId);
  const closingBalance = toDecimal(input.closingBalance);

  const closed = await prisma.cashSession.update({
    where: { id: sessionId },
    data: {
      status: "CLOSED" satisfies CashSessionStatus,
      closingBalance,
      expectedBalance,
      closedAt: new Date(),
      notes: input.notes ?? session.notes,
    },
    include: {
      operatorUser: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      movements: { orderBy: { createdAt: "desc" } },
    },
  });

  await writeAuditLog({
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: "cash.closed",
    entityType: "CashSession",
    entityId: closed.id,
    metadata: {
      expectedBalance: expectedBalance.toString(),
      closingBalance: closingBalance.toString(),
    },
  });

  return closed;
}

export async function addCashMovement(
  ctx: CashSessionContext,
  sessionId: string,
  input: {
    type: CashMovementType;
    amount: number | string | Decimal;
    notes?: string | null;
    idempotencyKey?: string | null;
  },
  db: DbClient = prisma
) {
  const { user } = ctx;
  if (!hasPermission(user, "finance:sell") && !hasPermission(user, "finance:cash_close")) {
    throw new Error("Sem permissão para movimentar caixa");
  }

  const session = await db.cashSession.findFirst({
    where: { id: sessionId, tenantId: user.tenantId },
  });
  if (!session) throw new Error("Sessão de caixa não encontrada");
  if (session.status !== "OPEN") throw new Error("Caixa fechado");

  const amount = toDecimal(input.amount);
  if (amount.lte(0)) throw new Error("Valor deve ser positivo");

  try {
    return await db.cashMovement.create({
      data: {
        tenantId: user.tenantId,
        sessionId,
        type: input.type,
        amount,
        notes: input.notes ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdByUserId: user.id,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err) && input.idempotencyKey) {
      const existing = await db.cashMovement.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

export type SerializedCashSession = {
  id: string;
  status: CashSessionStatus;
  openingBalance: number;
  closingBalance: number | null;
  expectedBalance: number | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  operatorName: string;
  locationName: string | null;
};

export function serializeCashSession(
  session: CashSession & {
    operatorUser?: { name: string } | null;
    location?: { name: string } | null;
  }
): SerializedCashSession {
  return {
    id: session.id,
    status: session.status,
    openingBalance: Number(session.openingBalance),
    closingBalance: session.closingBalance ? Number(session.closingBalance) : null,
    expectedBalance: session.expectedBalance ? Number(session.expectedBalance) : null,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    notes: session.notes,
    operatorName: session.operatorUser?.name ?? "—",
    locationName: session.location?.name ?? null,
  };
}
