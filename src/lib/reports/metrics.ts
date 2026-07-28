import "server-only";

import {
  eachDayOfInterval,
  endOfDay,
  startOfDay,
  subDays,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  parseWorkingDays,
} from "@/lib/domain/availability";
import { getTenantTimezone, parseHmToMinutes } from "@/lib/timezone";

export type ReportPeriod = "7d" | "30d" | "90d" | "month";

export type ReportMetrics = {
  period: { from: string; to: string };
  revenue: {
    total: number;
    paymentCount: number;
    byMethod: Record<string, number>;
  };
  occupancy: {
    bookedMinutes: number;
    availableMinutes: number;
    rate: number;
  };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    noShowRate: number;
  };
  clients: {
    newClients: number;
    returningClients: number;
    uniqueServed: number;
  };
};

function resolvePeriod(period: ReportPeriod, now = new Date()) {
  const to = endOfDay(now);
  let from: Date;

  switch (period) {
    case "7d":
      from = startOfDay(subDays(now, 6));
      break;
    case "30d":
      from = startOfDay(subDays(now, 29));
      break;
    case "90d":
      from = startOfDay(subDays(now, 89));
      break;
    case "month":
    default:
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      break;
  }

  return { from, to };
}

function computeAvailableMinutesPerDay(
  openTime: string,
  closeTime: string,
  workingDays: string,
  barberCount: number,
  date: Date,
  timeZone: string
): number {
  const weekdays = parseWorkingDays(workingDays);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).formatToParts(date);
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[weekdayStr ?? "Mon"] ?? 1;
  if (!weekdays.includes(weekday)) return 0;

  const openMin = parseHmToMinutes(openTime);
  const closeMin = parseHmToMinutes(closeTime);
  const daily = Math.max(0, closeMin - openMin);
  return daily * Math.max(1, barberCount);
}

export async function getReportMetrics(
  tenantId: string,
  period: ReportPeriod = "30d"
): Promise<ReportMetrics> {
  const { from, to } = resolvePeriod(period);

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const timeZone = getTenantTimezone(settings?.timeZone);

  const [payments, appointments, newClients, barberCount] = await Promise.all([
    prisma.salePayment.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: from, lte: to },
      },
      select: { amount: true, method: true },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        status: true,
        duration: true,
        clientId: true,
        scheduledAt: true,
        barberId: true,
      },
    }),
    prisma.client.count({
      where: { tenantId, createdAt: { gte: from, lte: to } },
    }),
    prisma.user.count({
      where: { tenantId, active: true, role: "BARBER" },
    }),
  ]);

  const revenueTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const byMethod: Record<string, number> = {};
  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  }

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const cancelled = appointments.filter((a) => a.status === "CANCELLED");
  const noShow = appointments.filter((a) => a.status === "NO_SHOW");
  const scheduledTotal = appointments.filter(
    (a) => a.status !== "CANCELLED"
  ).length;
  const noShowRate =
    scheduledTotal > 0 ? noShow.length / scheduledTotal : 0;

  const bookedMinutes = completed.reduce((s, a) => s + a.duration, 0);

  const days = eachDayOfInterval({ start: from, end: to });
  let availableMinutes = 0;
  for (const day of days) {
    availableMinutes += computeAvailableMinutesPerDay(
      settings?.openTime ?? "07:00",
      settings?.closeTime ?? "22:00",
      settings?.workingDays ?? "1,2,3,4,5,6",
      barberCount || 1,
      day,
      timeZone
    );
  }

  const servedClientIds = new Set(
    completed.map((a) => a.clientId).filter(Boolean) as string[]
  );

  const priorVisitClients = await prisma.appointment.findMany({
    where: {
      tenantId,
      status: "COMPLETED",
      scheduledAt: { lt: from },
      clientId: { in: [...servedClientIds] },
    },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  const returningSet = new Set(priorVisitClients.map((a) => a.clientId));
  const returningClients = [...servedClientIds].filter((id) =>
    returningSet.has(id)
  ).length;

  const occupancyRate =
    availableMinutes > 0 ? bookedMinutes / availableMinutes : 0;

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    revenue: {
      total: revenueTotal,
      paymentCount: payments.length,
      byMethod,
    },
    occupancy: {
      bookedMinutes,
      availableMinutes,
      rate: Math.min(1, occupancyRate),
    },
    appointments: {
      total: appointments.length,
      completed: completed.length,
      cancelled: cancelled.length,
      noShow: noShow.length,
      noShowRate,
    },
    clients: {
      newClients,
      returningClients,
      uniqueServed: servedClientIds.size,
    },
  };
}

export function metricsToCsv(metrics: ReportMetrics): string {
  const rows = [
    ["Métrica", "Valor"],
    ["Período início", metrics.period.from],
    ["Período fim", metrics.period.to],
    ["Receita (SalePayment COMPLETED)", metrics.revenue.total.toFixed(2)],
    ["Pagamentos", String(metrics.revenue.paymentCount)],
    ["Taxa ocupação", `${(metrics.occupancy.rate * 100).toFixed(1)}%`],
    ["Minutos agendados", String(metrics.occupancy.bookedMinutes)],
    ["Minutos disponíveis", String(metrics.occupancy.availableMinutes)],
    ["No-show rate", `${(metrics.appointments.noShowRate * 100).toFixed(1)}%`],
    ["Agendamentos completados", String(metrics.appointments.completed)],
    ["No-shows", String(metrics.appointments.noShow)],
    ["Clientes novos", String(metrics.clients.newClients)],
    ["Clientes retornantes", String(metrics.clients.returningClients)],
    ["Clientes únicos atendidos", String(metrics.clients.uniqueServed)],
  ];

  for (const [method, amount] of Object.entries(metrics.revenue.byMethod)) {
    rows.push([`Receita ${method}`, amount.toFixed(2)]);
  }

  return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}
