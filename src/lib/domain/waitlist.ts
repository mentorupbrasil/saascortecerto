import "server-only";

import { createHash, randomBytes } from "crypto";
import { addHours } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  getAvailableSlots,
  hasConflict,
  type OccupancyBlock,
} from "@/lib/domain/availability";
import { getTenantTimezone, parseHmToMinutes, zonedParts } from "@/lib/timezone";
import { createAppointmentWithConflictGuard } from "@/lib/domain/appointment-create";

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

async function loadOfferOccupancy(
  tenantId: string,
  slotAt: Date,
  barberId: string | null
): Promise<OccupancyBlock[]> {
  const dayStart = new Date(slotAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(slotAt);
  dayEnd.setHours(23, 59, 59, 999);

  const [appointments, pendingCheckouts, timeOffs] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["CANCELLED"] },
      },
      select: { scheduledAt: true, duration: true, barberId: true, status: true },
    }),
    prisma.publicBookingCheckout.findMany({
      where: {
        tenantId,
        status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] },
        expiresAt: { gt: new Date() },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, serviceDuration: true, barberId: true },
    }),
    barberId
      ? prisma.barberTimeOff.findMany({
          where: {
            tenantId,
            barberId,
            startsAt: { lte: dayEnd },
            endsAt: { gte: dayStart },
          },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...appointments.map((a) => ({
      scheduledAt: a.scheduledAt,
      duration: a.duration,
      barberId: a.barberId,
      status: a.status,
      kind: "appointment" as const,
    })),
    ...pendingCheckouts.map((c) => ({
      scheduledAt: c.scheduledAt,
      duration: c.serviceDuration ?? 30,
      barberId: c.barberId,
      kind: "checkout" as const,
    })),
    ...timeOffs.map((t) => ({
      scheduledAt: t.startsAt,
      duration: Math.max(1, Math.round((t.endsAt.getTime() - t.startsAt.getTime()) / 60000)),
      barberId: t.barberId,
      kind: "time_off" as const,
    })),
  ];
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

export type OfferSlotOptions = {
  tenantId: string;
  offerHours?: number;
  barberId?: string | null;
};

export type OfferSlotResult = {
  entry: Awaited<ReturnType<typeof prisma.waitlistEntry.update>>;
  /** Plaintext token — only ever returned here; the DB stores just its hash. */
  token: string;
};

/**
 * Offers a specific slot to a waitlist entry. Validates the entry, service,
 * barber, offer window and slot availability comprehensively, then generates
 * a single-use confirmation token (SHA-256 hash stored, plaintext returned
 * once for the WhatsApp link).
 */
export async function offerSlot(
  entryId: string,
  slotAt: Date,
  options: OfferSlotOptions
): Promise<OfferSlotResult> {
  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: entryId },
    include: { service: true },
  });
  if (!entry) throw new Error("Entrada não encontrada");
  if (entry.tenantId !== options.tenantId) {
    throw new Error("Entrada de outra barbearia");
  }
  if (entry.status !== "PENDING") {
    throw new Error("Entrada não está pendente");
  }
  if (!entry.service.active) {
    throw new Error("Serviço deste cliente está inativo");
  }

  const offerHours = options.offerHours ?? DEFAULT_OFFER_HOURS;
  if (!Number.isFinite(offerHours) || offerHours < 1 || offerHours > 24) {
    throw new Error("Prazo da oferta deve ser entre 1 e 24 horas");
  }

  const barberId = options.barberId ?? entry.barberId ?? null;
  if (barberId) {
    const barber = await prisma.user.findFirst({
      where: { id: barberId, tenantId: options.tenantId, role: "BARBER", active: true },
    });
    if (!barber) throw new Error("Profissional inválido ou inativo");
  }

  if (entry.preferredDates) {
    const dates = entry.preferredDates.split(",").map((d) => d.trim());
    const dateKey = slotAt.toISOString().slice(0, 10);
    if (dates.length > 0 && !dates.includes(dateKey)) {
      throw new Error("Horário fora das datas preferidas pelo cliente");
    }
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: options.tenantId },
  });
  if (!settings) throw new Error("Configurações da barbearia não encontradas");

  const timeZone = getTenantTimezone(settings.timeZone);
  if (entry.preferredTimeStart || entry.preferredTimeEnd) {
    const parts = zonedParts(slotAt, timeZone);
    const slotMinutes = parts.hours * 60 + parts.minutes;
    if (entry.preferredTimeStart && slotMinutes < parseHmToMinutes(entry.preferredTimeStart)) {
      throw new Error("Horário antes da preferência do cliente");
    }
    if (entry.preferredTimeEnd && slotMinutes > parseHmToMinutes(entry.preferredTimeEnd)) {
      throw new Error("Horário depois da preferência do cliente");
    }
  }

  const occupancy = await loadOfferOccupancy(options.tenantId, slotAt, barberId);
  const available = getAvailableSlots({
    date: slotAt,
    timeZone,
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    workingDays: settings.workingDays,
    serviceDuration: entry.service.duration,
    bufferBeforeMinutes: settings.bufferBeforeMinutes,
    bufferAfterMinutes: settings.bufferAfterMinutes,
    occupancy,
    barberId: barberId ?? undefined,
    now: new Date(Date.now() - 60_000),
  });

  if (!available.includes(slotAt.toISOString())) {
    throw new Error("Horário indisponível para oferta");
  }

  const rawToken = randomBytes(32).toString("hex");
  const offerTokenHash = createHash("sha256").update(rawToken).digest("hex");
  const offerExpiresAt = addHours(new Date(), offerHours);

  const updated = await prisma.waitlistEntry.update({
    where: { id: entryId },
    data: {
      status: "OFFERED",
      offeredSlotAt: slotAt,
      offerExpiresAt,
      offeredBarberId: barberId,
      offerTokenHash,
      offerTokenUsedAt: null,
    },
    include: { service: true, barber: { select: { id: true, name: true } } },
  });

  return { entry: updated, token: rawToken };
}

/**
 * Confirms a waitlist offer from its plaintext token (received via WhatsApp
 * link). Verifies the hash, expiry and single-use guarantee, re-validates
 * availability, then creates the appointment atomically — origin WAITLIST,
 * linked back to the entry.
 */
export async function confirmWaitlistOffer(rawToken: string) {
  const trimmed = rawToken.trim();
  if (!trimmed) throw new Error("Link de confirmação inválido");

  const tokenHash = createHash("sha256").update(trimmed).digest("hex");

  const entry = await prisma.waitlistEntry.findUnique({
    where: { offerTokenHash: tokenHash },
    include: { service: true, tenant: { select: { id: true, name: true, slug: true } } },
  });
  if (!entry) {
    throw new Error("Link de confirmação inválido ou já utilizado");
  }
  if (entry.offerTokenUsedAt) {
    throw new Error("Esta oferta já foi confirmada anteriormente");
  }
  if (entry.status !== "OFFERED" || !entry.offeredSlotAt || !entry.offerExpiresAt) {
    throw new Error("Esta oferta não está mais disponível");
  }
  if (entry.offerExpiresAt.getTime() < Date.now()) {
    await prisma.waitlistEntry.updateMany({
      where: { id: entry.id, status: "OFFERED" },
      data: { status: "EXPIRED" },
    });
    throw new Error("Esta oferta expirou. Entre em contato com a barbearia.");
  }

  const phone = entry.clientPhone.replace(/\D/g, "");
  let client = entry.clientId
    ? await prisma.client.findUnique({ where: { id: entry.clientId } })
    : await prisma.client.findFirst({ where: { tenantId: entry.tenantId, phone } });

  if (!client) {
    client = await prisma.client.create({
      data: { tenantId: entry.tenantId, name: entry.clientName, phone },
    });
  }

  const barberId = entry.offeredBarberId ?? entry.barberId ?? null;
  const offeredSlotAt = entry.offeredSlotAt;

  const appointment = await createAppointmentWithConflictGuard({
    tenantId: entry.tenantId,
    clientId: client.id,
    serviceId: entry.serviceId,
    barberId,
    scheduledAt: offeredSlotAt,
    duration: entry.service.duration,
    price: entry.service.price,
    status: "SCHEDULED",
    bookedOnline: true,
    notes: "Confirmado via lista de espera",
    origin: "WAITLIST",
    waitlistEntryId: entry.id,
    afterCreate: async (tx) => {
      const claimed = await tx.waitlistEntry.updateMany({
        where: { id: entry.id, status: "OFFERED", offerTokenUsedAt: null },
        data: { status: "BOOKED", offerTokenUsedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new Error("Esta oferta já foi confirmada anteriormente");
      }
    },
  });

  return {
    appointment,
    entry,
    client,
    tenant: entry.tenant,
    service: entry.service,
    scheduledAt: offeredSlotAt,
  };
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
