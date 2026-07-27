import "server-only";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appointmentScopeFilter,
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

export async function updateAppointmentStatusSecure(
  appointmentId: string,
  nextStatus: AppointmentStatus,
  actor?: AuthenticatedUser
) {
  const user = actor ?? (await requireTenantUser());
  const tenantId = user.tenantId!;
  const scope = appointmentScopeFilter(user);

  const result = await prisma.$transaction(async (tx) => {
    const apt = await tx.appointment.findFirst({
      where: { id: appointmentId, tenantId, ...scope },
    });
    if (!apt) {
      throw new Error("Agendamento não encontrado");
    }

    if (!canTransitionAppointment(apt.status, nextStatus)) {
      throw new Error(
        `Transição inválida: ${apt.status} → ${nextStatus}`
      );
    }

    const updated = await tx.appointment.updateMany({
      where: {
        id: appointmentId,
        tenantId,
        status: apt.status, // optimistic concurrency on status
        ...scope,
      },
      data: {
        status: nextStatus,
        ...(nextStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
        ...(nextStatus === "CONFIRMED" ? {} : {}),
        ...(nextStatus === "CANCELLED" ? {} : {}),
      },
    });

    if (updated.count !== 1) {
      throw new Error("Agendamento não foi alterado (conflito ou estado inválido)");
    }

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
        const active = await tx.clientMembership.findFirst({
          where: { clientId: apt.clientId, tenantId, status: "ACTIVE" },
        });
        if (active) {
          membershipId = active.id;
          await tx.appointment.update({
            where: { id: apt.id },
            data: { membershipId: active.id },
          });
        }
      }

      if (membershipId) {
        // redemption uses its own idempotency; call outside nested tx if needed
        // but recordMembershipVisit uses prisma root — invoke after commit via flag
      }

      return { apt, membershipId, previousStatus: apt.status, completed: true as const };
    }

    return {
      apt,
      membershipId: null as string | null,
      previousStatus: apt.status,
      completed: false as const,
    };
  });

  if (result.completed && result.membershipId) {
    await recordMembershipVisit(result.membershipId, {
      appointmentId: result.apt.id,
      tenantId,
    });
  }

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
