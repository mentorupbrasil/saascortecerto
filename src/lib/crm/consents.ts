import "server-only";

import { prisma } from "@/lib/prisma";
import type { ConsentType } from "@prisma/client";

export type RecordConsentInput = {
  tenantId: string;
  clientId: string;
  type: ConsentType;
  granted: boolean;
  source?: string;
};

export async function recordConsent(input: RecordConsentInput) {
  const now = new Date();

  return prisma.clientConsent.upsert({
    where: {
      clientId_type: { clientId: input.clientId, type: input.type },
    },
    create: {
      tenantId: input.tenantId,
      clientId: input.clientId,
      type: input.type,
      granted: input.granted,
      grantedAt: now,
      source: input.source ?? "manual",
    },
    update: {
      granted: input.granted,
      grantedAt: input.granted ? now : undefined,
      revokedAt: input.granted ? null : now,
      source: input.source ?? "manual",
    },
  });
}

export async function revokeConsent(
  tenantId: string,
  clientId: string,
  type: ConsentType,
  source?: string
) {
  const existing = await prisma.clientConsent.findUnique({
    where: { clientId_type: { clientId, type } },
  });
  if (!existing || existing.tenantId !== tenantId) {
    throw new Error("Consentimento não encontrado");
  }

  return prisma.clientConsent.update({
    where: { clientId_type: { clientId, type } },
    data: {
      granted: false,
      revokedAt: new Date(),
      source: source ?? existing.source,
    },
  });
}

export async function hasActiveConsent(
  clientId: string,
  type: ConsentType
): Promise<boolean> {
  const consent = await prisma.clientConsent.findUnique({
    where: { clientId_type: { clientId, type } },
  });
  if (!consent) return false;
  return consent.granted && !consent.revokedAt;
}

export async function listClientConsents(tenantId: string, clientId: string) {
  return prisma.clientConsent.findMany({
    where: { tenantId, clientId },
    orderBy: { type: "asc" },
  });
}
