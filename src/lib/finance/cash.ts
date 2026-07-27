import "server-only";
import { Decimal } from "@prisma/client/runtime/library";
import type {
  CashMovementType,
  CashSession,
  CashSessionStatus,
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

function toDecimal(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
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

async function computeExpectedBalance(sessionId: string): Promise<Decimal> {
  const session = await prisma.cashSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { movements: true },
  });

  let balance = toDecimal(session.openingBalance);
  for (const m of session.movements) {
    const amount = toDecimal(m.amount);
    if (m.type === "BLEED") {
      balance = balance.minus(amount);
    } else {
      balance = balance.plus(amount);
    }
  }
  return balance;
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
    amount: number | string;
    notes?: string | null;
  }
) {
  const { user } = ctx;
  if (!hasPermission(user, "finance:sell") && !hasPermission(user, "finance:cash_close")) {
    throw new Error("Sem permissão para movimentar caixa");
  }

  const session = await prisma.cashSession.findFirst({
    where: { id: sessionId, tenantId: user.tenantId },
  });
  if (!session) throw new Error("Sessão de caixa não encontrada");
  if (session.status !== "OPEN") throw new Error("Caixa fechado");

  const amount = toDecimal(input.amount);
  if (amount.lte(0)) throw new Error("Valor deve ser positivo");

  const movement = await prisma.cashMovement.create({
    data: {
      tenantId: user.tenantId,
      sessionId,
      type: input.type,
      amount,
      notes: input.notes ?? null,
      createdByUserId: user.id,
    },
  });

  return movement;
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
