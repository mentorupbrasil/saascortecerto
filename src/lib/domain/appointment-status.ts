import "server-only";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appointmentScopeFilter,
  AuthError,
  hasPermission,
  requireTenantUser,
  type AuthenticatedUser,
} from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import { recordMembershipVisit } from "@/lib/domain/membership-redemption";
import { logger } from "@/lib/logging/logger";

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "CANCELLED", "NO_SHOW", "COMPLETED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW", "SCHEDULED"],
  COMPLETED: [], // terminal for side-effects; no re-complete
  CANCELLED: [],
  NO_SHOW: ["SCHEDULED", "CONFIRMED"], // allow reopen
};

export function canTransitionAppointment(
  from: AppointmentStatus,
  to: AppointmentStatus
) {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

type LockedAppointmentRow = {
  id: string;
  tenantId: string;
  clientId: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  membershipId: string | null;
  barberId: string | null;
};

export async function updateAppointmentStatusSecure(
  appointmentId: string,
  nextStatus: AppointmentStatus,
  actor?: AuthenticatedUser
) {
  const user = actor ?? (await requireTenantUser());
  const tenantId = user.tenantId!;
  const scope = appointmentScopeFilter(user);
  const scopeBarberId = "barberId" in scope ? (scope as { barberId: string }).barberId : null;

  const requiredPermission = nextStatus === "CANCELLED" ? "agenda:cancel" : "agenda:edit";
  if (!hasPermission(user, requiredPermission)) {
    throw new AuthError(
      "FORBIDDEN",
      nextStatus === "CANCELLED"
        ? "Sem permissão para cancelar agendamentos"
        : "Sem permissão para editar agendamentos"
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock the appointment row for the duration of the transaction so
    // concurrent status changes / completions on the same row serialize.
    const rows = await tx.$queryRaw<LockedAppointmentRow[]>`
      SELECT id, "tenantId", "clientId", "scheduledAt", status, "membershipId", "barberId"
      FROM "Appointment"
      WHERE id = ${appointmentId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
    const apt = rows[0];
    if (!apt) {
      throw new Error("Agendamento não encontrado");
    }
    if (scopeBarberId && apt.barberId !== scopeBarberId) {
      throw new Error("Agendamento não encontrado");
    }

    if (!canTransitionAppointment(apt.status, nextStatus)) {
      throw new Error(`Transição inválida: ${apt.status} → ${nextStatus}`);
    }

    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: nextStatus,
        ...(nextStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
    });

    await tx.appointmentHistory.create({
      data: {
        appointmentId: apt.id,
        tenantId,
        actorUserId: user.id,
        fromStatus: apt.status,
        toStatus: nextStatus,
      },
    });

    if (nextStatus === "COMPLETED" && apt.status !== "COMPLETED") {
      await tx.client.update({
        where: { id: apt.clientId },
        data: { lastVisitAt: apt.scheduledAt },
      });

      let membershipId = apt.membershipId;
      if (!membershipId) {
        // Lock the candidate active membership too, so two appointments for
        // the same client can't both claim the last remaining visit.
        const activeRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "ClientMembership"
          WHERE "clientId" = ${apt.clientId} AND "tenantId" = ${tenantId} AND status = 'ACTIVE'
          ORDER BY "createdAt" ASC
          LIMIT 1
          FOR UPDATE
        `;
        const active = activeRows[0];
        if (active) {
          membershipId = active.id;
          await tx.appointment.update({
            where: { id: apt.id },
            data: { membershipId: active.id },
          });
        }
      }

      if (membershipId) {
        // Runs inside this same transaction: if the membership is invalid or
        // out of balance, this throws and the whole completion rolls back.
        await recordMembershipVisit(membershipId, {
          appointmentId: apt.id,
          tenantId,
          visitDate: apt.scheduledAt,
          db: tx,
        });
      }
    }

    return { previousStatus: apt.status };
  }, { maxWait: 15_000, timeout: 30_000 });

  await writeAuditLog({
    tenantId,
    actorUserId: user.id,
    action: "appointment.status_changed",
    entityType: "Appointment",
    entityId: appointmentId,
    metadata: {
      from: result.previousStatus,
      to: nextStatus,
    },
  });

  logger.info("appointment_status_changed", {
    tenantId,
    userId: user.id,
    action: "appointment.status_changed",
    entity: "Appointment",
    entityId: appointmentId,
    result: "success",
  });

  return { success: true };
}
