import "server-only";

import { prisma } from "@/lib/prisma";
import { AuthError, requireTenantUser } from "@/lib/authz";
import { getTenantBillingForSession, type BillingAlertLevel } from "@/lib/billing-actions";
import { formatTime } from "@/lib/date-format";
import { addHours, endOfDay, startOfDay } from "date-fns";

export type TenantAlertKind =
  | "billing"
  | "online_booking"
  | "pending_pix"
  | "today_schedule";

export type TenantAlertSeverity = "info" | "warning" | "critical";

export type TenantAlert = {
  id: string;
  kind: TenantAlertKind;
  severity: TenantAlertSeverity;
  title: string;
  body: string;
  href: string;
  /** ISO — used for sorting (newest first) */
  at: string;
};

function billingSeverity(level: BillingAlertLevel): TenantAlertSeverity {
  if (level === "overdue") return "critical";
  if (level === "due_soon") return "warning";
  return "info";
}

/**
 * Computed in-app alerts for the logged-in tenant user.
 * No Notification table — derived from appointments, checkouts and billing.
 */
export async function getTenantAlertsForSession(options?: {
  billing?: Awaited<ReturnType<typeof getTenantBillingForSession>>;
}): Promise<TenantAlert[]> {
  try {
    const user = await requireTenantUser();
    const tenantId = user.tenantId;
    const now = new Date();
    const since = addHours(now, -48);
    const alerts: TenantAlert[] = [];

    const [onlineBookings, pendingPix, todayAppointments, billing] =
      await Promise.all([
        prisma.appointment.findMany({
          where: {
            tenantId,
            bookedOnline: true,
            createdAt: { gte: since },
            status: { not: "CANCELLED" },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            scheduledAt: true,
            createdAt: true,
            client: { select: { name: true } },
            service: { select: { name: true } },
          },
        }),
        prisma.publicBookingCheckout.findMany({
          where: {
            tenantId,
            status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] },
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            clientName: true,
            serviceName: true,
            scheduledAt: true,
            createdAt: true,
            status: true,
            amount: true,
          },
        }),
        prisma.appointment.findMany({
          where: {
            tenantId,
            scheduledAt: { gte: now, lte: endOfDay(now) },
            status: { in: ["SCHEDULED", "CONFIRMED"] },
          },
          orderBy: { scheduledAt: "asc" },
          take: 5,
          select: {
            id: true,
            scheduledAt: true,
            client: { select: { name: true } },
            service: { select: { name: true } },
          },
        }),
        options?.billing !== undefined
          ? Promise.resolve(options.billing)
          : getTenantBillingForSession(),
      ]);

    if (billing?.openInvoice && billing.alertLevel !== "none" && billing.alertMessage) {
      alerts.push({
        id: `billing:${billing.openInvoice.id}:${billing.alertLevel}`,
        kind: "billing",
        severity: billingSeverity(billing.alertLevel),
        title:
          billing.alertLevel === "overdue"
            ? "Fatura vencida"
            : billing.alertLevel === "due_soon"
              ? "Fatura vence em breve"
              : "Vencimento da fatura",
        body: billing.alertMessage,
        href: "/faturamento",
        at: billing.openInvoice.dueDate,
      });
    } else if (billing?.hasAwaitingConfirmation) {
      alerts.push({
        id: "billing:awaiting",
        kind: "billing",
        severity: "info",
        title: "Pagamento em análise",
        body: "Pagamento informado. Aguardando confirmação da plataforma.",
        href: "/faturamento",
        at: now.toISOString(),
      });
    }

    for (const checkout of pendingPix) {
      const waitingConfirm = checkout.status === "AWAITING_CONFIRMATION";
      alerts.push({
        id: `pix:${checkout.id}`,
        kind: "pending_pix",
        severity: waitingConfirm ? "warning" : "info",
        title: waitingConfirm ? "PIX aguardando confirmação" : "Agendamento aguardando PIX",
        body: `${checkout.clientName} · ${checkout.serviceName} · ${formatTime(checkout.scheduledAt)}`,
        href: "/agenda#online-bookings",
        at: checkout.createdAt.toISOString(),
      });
    }

    for (const apt of onlineBookings) {
      alerts.push({
        id: `online:${apt.id}`,
        kind: "online_booking",
        severity: "info",
        title: "Novo agendamento online",
        body: `${apt.client.name} · ${apt.service.name} · ${formatTime(apt.scheduledAt)}`,
        href: "/agenda#online-bookings",
        at: apt.createdAt.toISOString(),
      });
    }

    if (todayAppointments.length > 0) {
      const next = todayAppointments[0]!;
      const rest = todayAppointments.length - 1;
      alerts.push({
        id: `today:${startOfDay(now).toISOString().slice(0, 10)}:${todayAppointments.length}`,
        kind: "today_schedule",
        severity: "info",
        title:
          todayAppointments.length === 1
            ? "1 horário restante hoje"
            : `${todayAppointments.length} horários restantes hoje`,
        body:
          rest > 0
            ? `Próximo: ${formatTime(next.scheduledAt)} · ${next.client.name} (+${rest})`
            : `Próximo: ${formatTime(next.scheduledAt)} · ${next.client.name} · ${next.service.name}`,
        href: "/agenda",
        at: next.scheduledAt.toISOString(),
      });
    }

    const severityRank: Record<TenantAlertSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };

    alerts.sort((a, b) => {
      const bySeverity = severityRank[a.severity] - severityRank[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    return alerts;
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }
}
