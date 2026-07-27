import "server-only";

import { prisma } from "@/lib/prisma";
import type { LoyaltyLedgerType, Prisma } from "@prisma/client";

export type LoyaltyMovementInput = {
  tenantId: string;
  clientId: string;
  points: number;
  type: LoyaltyLedgerType;
  description?: string;
  saleId?: string;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

async function getOrCreateAccount(
  tenantId: string,
  clientId: string,
  tx: DbClient
) {
  const existing = await tx.loyaltyAccount.findUnique({
    where: { clientId },
  });
  if (existing) {
    if (existing.tenantId !== tenantId) {
      throw new Error("Conta de fidelidade de outra barbearia");
    }
    return existing;
  }

  return tx.loyaltyAccount.create({
    data: { tenantId, clientId, points: 0 },
  });
}

export async function creditLoyaltyPoints(input: LoyaltyMovementInput) {
  if (input.points <= 0) throw new Error("Pontos devem ser positivos");

  return prisma.$transaction(async (tx) => {
    const account = await getOrCreateAccount(input.tenantId, input.clientId, tx);

    await tx.loyaltyLedger.create({
      data: {
        tenantId: input.tenantId,
        accountId: account.id,
        type: input.type === "EARN" ? "EARN" : "ADJUSTMENT",
        points: input.points,
        description: input.description,
        saleId: input.saleId,
      },
    });

    return tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { points: account.points + input.points },
    });
  });
}

export async function debitLoyaltyPoints(input: LoyaltyMovementInput) {
  if (input.points <= 0) throw new Error("Pontos devem ser positivos");

  return prisma.$transaction(async (tx) => {
    const account = await getOrCreateAccount(input.tenantId, input.clientId, tx);
    if (account.points < input.points) {
      throw new Error("Saldo insuficiente de pontos");
    }

    await tx.loyaltyLedger.create({
      data: {
        tenantId: input.tenantId,
        accountId: account.id,
        type: input.type === "REDEEM" ? "REDEEM" : "ADJUSTMENT",
        points: -input.points,
        description: input.description,
        saleId: input.saleId,
      },
    });

    return tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { points: account.points - input.points },
    });
  });
}

export async function getLoyaltyBalance(tenantId: string, clientId: string) {
  const account = await prisma.loyaltyAccount.findFirst({
    where: { tenantId, clientId },
    include: {
      ledger: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  return account;
}
