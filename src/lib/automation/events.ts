import "server-only";

import { prisma } from "@/lib/prisma";
import type { DomainEventStatus } from "@prisma/client";

export type DomainEventPayload = Record<string, unknown>;

/**
 * Persists a domain event for async automation processing.
 */
export async function emitDomainEvent(
  tenantId: string,
  type: string,
  payload: DomainEventPayload
) {
  return prisma.domainEvent.create({
    data: {
      tenantId,
      eventType: type,
      payload: JSON.stringify(payload),
      status: "PENDING",
    },
  });
}

export function parseDomainEventPayload(raw: string): DomainEventPayload {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as DomainEventPayload;
    }
    return {};
  } catch {
    return {};
  }
}

export async function markDomainEventStatus(
  id: string,
  status: DomainEventStatus,
  processedAt?: Date
) {
  return prisma.domainEvent.update({
    where: { id },
    data: {
      status,
      processedAt: processedAt ?? (status === "PROCESSED" ? new Date() : undefined),
    },
  });
}
