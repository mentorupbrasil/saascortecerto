import "server-only";
import { prisma } from "@/lib/prisma";
import { addMinutes } from "date-fns";
import {
  hasConflict,
  parseWorkingDays,
  type OccupancyBlock,
} from "@/lib/domain/availability";
import {
  getTenantTimezone,
  parseHmToMinutes,
  wallTimeToUtc,
  zonedParts,
} from "@/lib/timezone";
import type { AppointmentStatus, Prisma } from "@prisma/client";

/**
 * Acquire a per-barber advisory lock and re-check conflicts inside a transaction.
 * PostgreSQL: pg_advisory_xact_lock(key1, key2)
 */
function lockKeys(tenantId: string, barberId: string) {
  let h1 = 0;
  let h2 = 0;
  for (let i = 0; i < tenantId.length; i++) {
    h1 = (h1 * 31 + tenantId.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < barberId.length; i++) {
    h2 = (h2 * 31 + barberId.charCodeAt(i)) | 0;
  }
  return { h1, h2 };
}

export type CreateAppointmentInput = {
  tenantId: string;
  clientId: string;
  serviceId: string;
  barberId: string | null;
  scheduledAt: Date;
  duration: number;
  price: unknown;
  paymentMethod?: "PIX" | "CASH" | "CARD" | null;
  notes?: string | null;
  bookedOnline?: boolean;
  origin?: string;
  membershipId?: string | null;
  status?: AppointmentStatus;
  waitlistEntryId?: string | null;
  /** When finalizing a checkout, exclude it from pending-checkout conflict checks */
  excludeCheckoutId?: string;
  /** Idempotent finalize: if checkout already has appointmentId, return it */
  checkoutId?: string;
  /** Run in the same transaction after the appointment row is created (e.g. mark checkout PAID) */
  afterCreate?: (
    tx: Prisma.TransactionClient,
    appointment: { id: string }
  ) => Promise<void>;
};

async function loadScheduleBreaks(
  tx: Prisma.TransactionClient,
  tenantId: string,
  barberId: string | null,
  scheduledAt: Date,
  timeZone: string
): Promise<OccupancyBlock[]> {
  if (!barberId) return [];

  const parts = zonedParts(scheduledAt, timeZone);
  const schedules = await tx.barberSchedule.findMany({
    where: { tenantId, barberId, weekday: parts.weekday, active: true },
    include: { breaks: true },
  });

  const blocks: OccupancyBlock[] = [];
  for (const schedule of schedules) {
    for (const brk of schedule.breaks) {
      const breakStart = wallTimeToUtc(parts.dateKey, brk.startTime, timeZone);
      const breakEnd = wallTimeToUtc(parts.dateKey, brk.endTime, timeZone);
      const duration = Math.max(
        1,
        Math.round((breakEnd.getTime() - breakStart.getTime()) / 60000)
      );
      blocks.push({
        scheduledAt: breakStart,
        duration,
        barberId,
        kind: "break",
      });
    }
  }
  return blocks;
}

/**
 * Assembles occupancy (appointments, pending checkouts, time off, schedule
 * breaks) around a candidate slot and throws if it conflicts. Shared by
 * appointment creation and reschedule so both enforce identical rules.
 */
async function assertSlotAvailable(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    barberId: string | null;
    scheduledAt: Date;
    duration: number;
    excludeCheckoutId?: string;
    /** Ignore this appointment's own row when checking for conflicts (reschedule) */
    excludeAppointmentId?: string;
  }
) {
  const settings = await tx.tenantSettings.findUnique({
    where: { tenantId: params.tenantId },
    select: {
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
      timeZone: true,
    },
  });
  const bufferBeforeMinutes = settings?.bufferBeforeMinutes ?? 0;
  const bufferAfterMinutes = settings?.bufferAfterMinutes ?? 0;
  const timeZone = getTenantTimezone(settings?.timeZone);

  const windowStart = addMinutes(params.scheduledAt, -params.duration);
  const windowEnd = addMinutes(params.scheduledAt, params.duration * 2);

  const checkoutWhere = {
    tenantId: params.tenantId,
    status: {
      in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] as Array<
        "PENDING_PAYMENT" | "AWAITING_CONFIRMATION"
      >,
    },
    expiresAt: { gt: new Date() },
    scheduledAt: { gte: windowStart, lte: windowEnd },
    ...(params.barberId ? { barberId: params.barberId } : {}),
    ...(params.excludeCheckoutId ? { id: { not: params.excludeCheckoutId } } : {}),
  };

  const [appointments, pendingCheckouts, timeOffs, scheduleBreaks] =
    await Promise.all([
      tx.appointment.findMany({
        where: {
          tenantId: params.tenantId,
          status: { notIn: ["CANCELLED"] },
          scheduledAt: { gte: windowStart, lte: windowEnd },
          ...(params.barberId ? { barberId: params.barberId } : {}),
          ...(params.excludeAppointmentId
            ? { id: { not: params.excludeAppointmentId } }
            : {}),
        },
        select: {
          scheduledAt: true,
          duration: true,
          barberId: true,
          status: true,
          blockType: true,
        },
      }),
      tx.publicBookingCheckout.findMany({
        where: checkoutWhere,
        select: {
          scheduledAt: true,
          serviceDuration: true,
          barberId: true,
          status: true,
        },
      }),
      params.barberId
        ? tx.barberTimeOff.findMany({
            where: {
              tenantId: params.tenantId,
              barberId: params.barberId,
              startsAt: { lte: addMinutes(params.scheduledAt, params.duration) },
              endsAt: { gte: params.scheduledAt },
            },
          })
        : Promise.resolve([]),
      loadScheduleBreaks(
        tx,
        params.tenantId,
        params.barberId,
        params.scheduledAt,
        timeZone
      ),
    ]);

  const occupancy: OccupancyBlock[] = [
    ...appointments.map((a) => ({
      scheduledAt: a.scheduledAt,
      duration: a.duration,
      barberId: a.barberId,
      status: a.status,
      kind: (a.blockType ? "break" : "appointment") as OccupancyBlock["kind"],
    })),
    ...pendingCheckouts.map((c) => ({
      scheduledAt: c.scheduledAt,
      duration: c.serviceDuration ?? params.duration,
      barberId: c.barberId,
      status: c.status,
      kind: "checkout" as const,
    })),
    ...timeOffs.map((t) => ({
      scheduledAt: t.startsAt,
      duration: Math.max(
        1,
        Math.round((t.endsAt.getTime() - t.startsAt.getTime()) / 60000)
      ),
      barberId: t.barberId,
      kind: "time_off" as const,
    })),
    ...scheduleBreaks,
  ];

  if (
    hasConflict({
      start: params.scheduledAt,
      duration: params.duration,
      barberId: params.barberId,
      occupancy,
      bufferBeforeMinutes,
      bufferAfterMinutes,
    })
  ) {
    throw new Error("Horário indisponível para este profissional");
  }
}

export async function createAppointmentWithConflictGuard(input: CreateAppointmentInput) {
  const barberKey = input.barberId ?? `__unassigned__:${input.tenantId}`;
  const { h1, h2 } = lockKeys(input.tenantId, barberKey);

  return prisma.$transaction(async (tx) => {
    if (input.checkoutId) {
      const checkout = await tx.publicBookingCheckout.findUnique({
        where: { id: input.checkoutId },
        include: { appointment: true },
      });
      if (checkout && checkout.tenantId !== input.tenantId) {
        throw new Error("Checkout não pertence a esta barbearia");
      }
      if (checkout?.appointmentId && checkout.appointment) {
        return checkout.appointment;
      }
    }

    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock($1::integer, $2::integer)`,
      h1,
      h2
    );

    await assertSlotAvailable(tx, {
      tenantId: input.tenantId,
      barberId: input.barberId,
      scheduledAt: input.scheduledAt,
      duration: input.duration,
      excludeCheckoutId: input.excludeCheckoutId,
    });

    const appointment = await tx.appointment.create({
      data: {
        tenantId: input.tenantId,
        clientId: input.clientId,
        serviceId: input.serviceId,
        barberId: input.barberId,
        scheduledAt: input.scheduledAt,
        duration: input.duration,
        price: input.price as never,
        paymentMethod: input.paymentMethod ?? undefined,
        notes: input.notes ?? undefined,
        bookedOnline: input.bookedOnline ?? false,
        origin: (input.origin as never) ?? "INTERNAL",
        membershipId: input.membershipId ?? undefined,
        waitlistEntryId: input.waitlistEntryId ?? undefined,
        status: input.status ?? undefined,
      },
    });

    if (input.afterCreate) {
      await input.afterCreate(tx, appointment);
    }

    return appointment;
  }, { maxWait: 15_000, timeout: 30_000 });
}

/** Alias for createAppointmentWithConflictGuard */
export const createAppointmentAtomic = createAppointmentWithConflictGuard;

async function assertWithinWorkingHours(
  tx: Prisma.TransactionClient,
  tenantId: string,
  scheduledAt: Date,
  duration: number
) {
  const settings = await tx.tenantSettings.findUnique({
    where: { tenantId },
    select: { openTime: true, closeTime: true, workingDays: true, timeZone: true },
  });
  if (!settings) return;

  const timeZone = getTenantTimezone(settings.timeZone);
  const parts = zonedParts(scheduledAt, timeZone);
  const weekdays = parseWorkingDays(settings.workingDays);
  if (!weekdays.includes(parts.weekday)) {
    throw new Error("A barbearia não funciona neste dia da semana");
  }

  const openMin = parseHmToMinutes(settings.openTime);
  const closeMin = parseHmToMinutes(settings.closeTime);
  const slotStartMin = parts.hours * 60 + parts.minutes;
  const slotEndMin = slotStartMin + duration;
  if (slotStartMin < openMin || slotEndMin > closeMin) {
    throw new Error("Horário fora do funcionamento da barbearia");
  }
}

export type RescheduleAppointmentInput = {
  tenantId: string;
  appointmentId: string;
  scheduledAt: Date;
  barberId: string | null;
  actorUserId: string;
  /** Row-level scope filter (e.g. barbers can only touch their own appointments) */
  scopeFilter?: Prisma.AppointmentWhereInput;
};

/**
 * Updates an existing appointment's date/time and barber in place (no new row
 * created). Re-validates working hours, barber, time off and conflicts —
 * ignoring the appointment's own current slot — then records an
 * AppointmentHistory entry with the before/after values.
 */
export async function rescheduleAppointmentWithConflictGuard(
  input: RescheduleAppointmentInput
) {
  const barberKey = input.barberId ?? `__unassigned__:${input.tenantId}`;
  const { h1, h2 } = lockKeys(input.tenantId, barberKey);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: {
        id: input.appointmentId,
        tenantId: input.tenantId,
        ...(input.scopeFilter ?? {}),
      },
    });
    if (!existing) {
      throw new Error("Agendamento não encontrado");
    }
    if (existing.status === "CANCELLED" || existing.status === "COMPLETED") {
      throw new Error("Não é possível reagendar um horário cancelado ou concluído");
    }

    if (input.barberId) {
      const barber = await tx.user.findFirst({
        where: { id: input.barberId, tenantId: input.tenantId, active: true },
        select: { id: true, role: true },
      });
      if (!barber) throw new Error("Profissional inválido");
      const canServe =
        barber.role === "OWNER" ||
        barber.role === "MANAGER" ||
        barber.role === "BARBER";
      if (!canServe) {
        throw new Error("Profissional selecionado não pode atender serviços");
      }
    }

    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock($1::integer, $2::integer)`,
      h1,
      h2
    );

    await assertWithinWorkingHours(
      tx,
      input.tenantId,
      input.scheduledAt,
      existing.duration
    );

    await assertSlotAvailable(tx, {
      tenantId: input.tenantId,
      barberId: input.barberId,
      scheduledAt: input.scheduledAt,
      duration: existing.duration,
      excludeAppointmentId: existing.id,
    });

    const changes = {
      scheduledAt: {
        from: existing.scheduledAt.toISOString(),
        to: input.scheduledAt.toISOString(),
      },
      barberId: { from: existing.barberId, to: input.barberId },
    };

    const updated = await tx.appointment.update({
      where: { id: existing.id },
      data: {
        scheduledAt: input.scheduledAt,
        barberId: input.barberId,
      },
    });

    await tx.appointmentHistory.create({
      data: {
        appointmentId: existing.id,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        fromStatus: existing.status,
        toStatus: existing.status,
        changes: JSON.stringify(changes),
      },
    });

    return updated;
  }, { maxWait: 15_000, timeout: 30_000 });
}
