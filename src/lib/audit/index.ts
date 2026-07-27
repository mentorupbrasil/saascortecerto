import "server-only";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "user.login_admin"
  | "user.role_changed"
  | "user.activated"
  | "user.deactivated"
  | "settings.updated"
  | "payment.manual_confirmed"
  | "appointment.created"
  | "appointment.updated"
  | "appointment.status_changed"
  | "appointment.cancelled"
  | "cash.opened"
  | "cash.closed"
  | "cash.reopened"
  | "inventory.adjusted"
  | "commission.changed"
  | "membership.changed"
  | "client.exported"
  | "client.anonymized"
  | "integration.updated";

export async function writeAuditLog(input: {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    // Never fail the business operation because of audit write
    console.error(
      JSON.stringify({
        level: "error",
        message: "audit_log_write_failed",
        error: err instanceof Error ? err.message : "unknown",
      })
    );
  }
}
