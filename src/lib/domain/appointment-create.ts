import "server-only";
import { prisma } from "@/lib/prisma";
import { addMinutes } from "date-fns";
import { hasConflict, type OccupancyBlock } from "@/lib/domain/availability";
import {
  getTenantTimezone,
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

    const settings = await tx.tenantSettings.findUnique({
      where: { tenantId: input.tenantId },
      select: {
        bufferBeforeMinutes: true,
        bufferAfterMinutes: true,
        timeZone: true,
      },
    });
    const bufferBeforeMinutes = settings?.bufferBeforeMinutes ?? 0;
    const bufferAfterMinutes = settings?.bufferAfterMinutes ?? 0;
    const timeZone = getTenantTimezone(settings?.timeZone);

    const windowStart = addMinutes(input.scheduledAt, -input.duration);
    const windowEnd = addMinutes(input.scheduledAt, input.duration * 2);

    const checkoutWhere = {
      tenantId: input.tenantId,
      status: {
        in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] as Array<
          "PENDING_PAYMENT" | "AWAITING_CONFIRMATION"
        >,
      },
      expiresAt: { gt: new Date() },
      scheduledAt: { gte: windowStart, lte: windowEnd },
      ...(input.barberId ? { barberId: input.barberId } : {}),
      ...(input.excludeCheckoutId ? { id: { not: input.excludeCheckoutId } } : {}),
    };

    const [appointments, pendingCheckouts, timeOffs, scheduleBreaks] =
      await Promise.all([
        tx.appointment.findMany({
          where: {
            tenantId: input.tenantId,
            status: { notIn: ["CANCELLED"] },
            scheduledAt: { gte: windowStart, lte: windowEnd },
            ...(input.barberId ? { barberId: input.barberId } : {}),
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
        input.barberId
          ? tx.barberTimeOff.findMany({
              where: {
                tenantId: input.tenantId,
                barberId: input.barberId,
                startsAt: { lte: addMinutes(input.scheduledAt, input.duration) },
                endsAt: { gte: input.scheduledAt },
              },
            })
          : Promise.resolve([]),
        loadScheduleBreaks(
          tx,
          input.tenantId,
          input.barberId,
          input.scheduledAt,
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
        duration: c.serviceDuration ?? input.duration,
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
        start: input.scheduledAt,
        duration: input.duration,
        barberId: input.barberId,
        occupancy,
        bufferBeforeMinutes,
        bufferAfterMinutes,
      })
    ) {
      throw new Error("Horário indisponível para este profissional");
    }

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
        status: input.status ?? undefined,
      },
    });

    if (input.afterCreate) {
      await input.afterCreate(tx, appointment);
    }

    return appointment;
  });
}

/** Alias for createAppointmentWithConflictGuard */
export const createAppointmentAtomic = createAppointmentWithConflictGuard;
