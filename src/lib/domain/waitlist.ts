import "server-only";

import { addHours } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  getAvailableSlots,
  hasConflict,
  type OccupancyBlock,
} from "@/lib/domain/availability";
import { getTenantTimezone } from "@/lib/timezone";

export type JoinWaitlistInput = {
  tenantId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  barberId?: string | null;
  clientId?: string | null;
  preferredDates?: string | null;
  preferredTimeStart?: string | null;
  preferredTimeEnd?: string | null;
  priority?: number;
  notes?: string | null;
};

const DEFAULT_OFFER_HOURS = 2;

export async function joinWaitlist(input: JoinWaitlistInput) {
  const phone = input.clientPhone.replace(/\D/g, "");

  let clientId = input.clientId ?? null;
  if (!clientId) {
    const existing = await prisma.client.findFirst({
      where: { tenantId: input.tenantId, phone },
      select: { id: true },
    });
    clientId = existing?.id ?? null;
  }

  return prisma.waitlistEntry.create({
    data: {
      tenantId: input.tenantId,
      clientId,
      clientName: input.clientName.trim(),
      clientPhone: phone,
      serviceId: input.serviceId,
      barberId: input.barberId ?? null,
      preferredDates: input.preferredDates ?? null,
      preferredTimeStart: input.preferredTimeStart ?? null,
      preferredTimeEnd: input.preferredTimeEnd ?? null,
      priority: input.priority ?? 0,
      notes: input.notes ?? null,
      status: "PENDING",
    },
    include: { service: true, barber: { select: { id: true, name: true } } },
  });
}

async function loadOccupancy(tenantId: string, date: Date): Promise<OccupancyBlock[]> {
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

  return appointments.map((a) => ({
    scheduledAt: a.scheduledAt,
    duration: a.duration,
    barberId: a.barberId,
    status: a.status,
    kind: "appointment" as const,
  }));
}

export async function findCandidatesForSlot(
  tenantId: string,
  slotAt: Date,
  serviceId: string,
  barberId?: string | null
) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, tenantId },
  });
  if (!service) return [];

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (!settings) return [];

  const occupancy = await loadOccupancy(tenantId, slotAt);
  const conflict = hasConflict({
    start: slotAt,
    duration: service.duration,
    barberId: barberId ?? undefined,
    occupancy,
    bufferBeforeMinutes: settings.bufferBeforeMinutes,
    bufferAfterMinutes: settings.bufferAfterMinutes,
  });
  if (conflict) return [];

  const entries = await prisma.waitlistEntry.findMany({
    where: {
      tenantId,
      serviceId,
      status: "PENDING",
      ...(barberId ? { OR: [{ barberId }, { barberId: null }] } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: { service: true, client: true },
  });

  const tz = getTenantTimezone(settings.timeZone);
  const slotIso = slotAt.toISOString();

  const available = getAvailableSlots({
    date: slotAt,
    timeZone: tz,
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    workingDays: settings.workingDays,
    serviceDuration: service.duration,
    bufferBeforeMinutes: settings.bufferBeforeMinutes,
    bufferAfterMinutes: settings.bufferAfterMinutes,
    occupancy,
    barberId: barberId ?? undefined,
    now: new Date(Date.now() - 60_000),
  });

  if (!available.includes(slotIso)) return [];

  return entries.filter((entry) => {
    if (entry.preferredDates) {
      const dates = entry.preferredDates.split(",").map((d) => d.trim());
      const dateKey = slotAt.toISOString().slice(0, 10);
      if (dates.length > 0 && !dates.includes(dateKey)) return false;
    }
    return true;
  });
}

export async function offerSlot(
  entryId: string,
  slotAt: Date,
  options?: { offerHours?: number; tenantId?: string }
) {
  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: entryId },
  });
  if (!entry) throw new Error("Entrada não encontrada");
  if (options?.tenantId && entry.tenantId !== options.tenantId) {
    throw new Error("Entrada de outra barbearia");
  }
  if (entry.status !== "PENDING") {
    throw new Error("Entrada não está pendente");
  }

  const hours = options?.offerHours ?? DEFAULT_OFFER_HOURS;
  const offerExpiresAt = addHours(new Date(), hours);

  return prisma.waitlistEntry.update({
    where: { id: entryId },
    data: {
      status: "OFFERED",
      offeredSlotAt: slotAt,
      offerExpiresAt,
    },
    include: { service: true, barber: { select: { id: true, name: true } } },
  });
}

export async function expireStaleOffers(tenantId?: string) {
  const now = new Date();
  const result = await prisma.waitlistEntry.updateMany({
    where: {
      status: "OFFERED",
      offerExpiresAt: { lt: now },
      ...(tenantId ? { tenantId } : {}),
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

export async function listWaitlistEntries(tenantId: string) {
  return prisma.waitlistEntry.findMany({
    where: { tenantId, status: { not: "CANCELLED" } },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    include: {
      service: { select: { id: true, name: true, duration: true } },
      barber: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  });
}
