import "server-only";

import { getAvailableSlots, type OccupancyBlock } from "@/lib/domain/availability";
import { prisma } from "@/lib/prisma";
import { getTenantTimezone } from "@/lib/timezone";
import { isAiEnabled } from "@/lib/env";

/**
 * AI assistant stub — read-only tools over domain layer.
 *
 * Security notes (prompt injection):
 * - Never pass raw user text into DB queries or mutations.
 * - Tools return structured data only; the LLM must not invent availability.
 * - All scheduling writes must go through validated server actions, not here.
 */

export { isAiEnabled } from "@/lib/env";

export type AiToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; code?: string };

export async function aiToolCheckAvailability(
  tenantId: string,
  input: {
    dateIso: string;
    serviceId: string;
    barberId?: string | null;
  }
): Promise<AiToolResult> {
  if (!isAiEnabled()) {
    return { ok: false, error: "Assistente IA desativado", code: "disabled" };
  }

  const date = new Date(input.dateIso);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Data inválida" };
  }

  const [service, settings] = await Promise.all([
    prisma.service.findFirst({ where: { id: input.serviceId, tenantId } }),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ]);

  if (!service) return { ok: false, error: "Serviço não encontrado" };
  if (!settings) return { ok: false, error: "Configurações não encontradas" };

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED"] },
    },
    select: {
      scheduledAt: true,
      duration: true,
      barberId: true,
      status: true,
    },
  });

  const occupancy: OccupancyBlock[] = appointments.map((a) => ({
    scheduledAt: a.scheduledAt,
    duration: a.duration,
    barberId: a.barberId,
    status: a.status,
    kind: "appointment",
  }));

  const tz = getTenantTimezone(settings.timeZone);
  const slots = getAvailableSlots({
    date,
    timeZone: tz,
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    workingDays: settings.workingDays,
    serviceDuration: service.duration,
    bufferBeforeMinutes: settings.bufferBeforeMinutes,
    bufferAfterMinutes: settings.bufferAfterMinutes,
    occupancy,
    barberId: input.barberId ?? undefined,
  });

  return {
    ok: true,
    data: {
      service: service.name,
      date: input.dateIso,
      slots,
      slotCount: slots.length,
    },
  };
}

export async function aiToolListServices(tenantId: string): Promise<AiToolResult> {
  if (!isAiEnabled()) {
    return { ok: false, error: "Assistente IA desativado", code: "disabled" };
  }

  const services = await prisma.service.findMany({
    where: { tenantId },
    select: { id: true, name: true, duration: true, price: true },
    orderBy: { name: "asc" },
  });

  return { ok: true, data: services };
}

export type AiAssistantMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * Placeholder — wire to LLM when AI_API_KEY is configured.
 * Does not write to DB; tools are invoked explicitly by orchestration layer.
 */
export async function runAiAssistantTurn(
  _tenantId: string,
  _messages: AiAssistantMessage[]
): Promise<AiToolResult> {
  if (!isAiEnabled()) {
    return {
      ok: false,
      error: "Assistente IA desativado. Defina AI_ENABLED=true e AI_API_KEY.",
      code: "disabled",
    };
  }

  return {
    ok: false,
    error: "Integração LLM não implementada nesta versão. Use aiToolCheckAvailability e aiToolListServices.",
    code: "not_implemented",
  };
}
