import "server-only";
import { prisma } from "@/lib/prisma";
import { addMinutes } from "date-fns";
import { hasConflict, type OccupancyBlock } from "@/lib/domain/availability";

/**
 * Acquire a per-barber advisory lock and re-check conflicts inside a transaction.
 * PostgreSQL: pg_advisory_xact_lock(key1, key2)
 */
function lockKeys(tenantId: string, barberId: string) {
  // Stable 32-bit-ish hashes
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

export async function createAppointmentWithConflictGuard(input: {
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
}) {
  const barberKey = input.barberId ?? `__unassigned__:${input.tenantId}`;
  const { h1, h2 } = lockKeys(input.tenantId, barberKey);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${h1}, ${h2})`;

    const windowStart = addMinutes(input.scheduledAt, -input.duration);
    const windowEnd = addMinutes(input.scheduledAt, input.duration * 2);

    const [appointments, pendingCheckouts, timeOffs] = await Promise.all([
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
        },
      }),
      tx.publicBookingCheckout.findMany({
        where: {
          tenantId: input.tenantId,
          status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] },
          expiresAt: { gt: new Date() },
          scheduledAt: { gte: windowStart, lte: windowEnd },
          ...(input.barberId ? { barberId: input.barberId } : {}),
        },
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
    ]);

    const occupancy: OccupancyBlock[] = [
      ...appointments.map((a) => ({
        scheduledAt: a.scheduledAt,
        duration: a.duration,
        barberId: a.barberId,
        status: a.status,
        kind: "appointment" as const,
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
    ];

    if (
      hasConflict({
        start: input.scheduledAt,
        duration: input.duration,
        barberId: input.barberId,
        occupancy,
      })
    ) {
      throw new Error("Horário indisponível para este profissional");
    }

    return tx.appointment.create({
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
      },
    });
  });
}
