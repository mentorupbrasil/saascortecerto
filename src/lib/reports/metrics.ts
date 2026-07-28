import "server-only";

import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
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

export type ReportDashboardData = {
  metrics: ReportMetrics;
  previous: ReportMetrics | null;
  topServices: { name: string; count: number }[];
  barberPerformance: { name: string; completed: number }[];
  statusEvolution: { label: string; cancelled: number; noShow: number }[];
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

function resolvePreviousPeriod(period: ReportPeriod, now = new Date()) {
  switch (period) {
    case "7d":
      return {
        from: startOfDay(subDays(now, 13)),
        to: endOfDay(subDays(now, 7)),
      };
    case "30d":
      return {
        from: startOfDay(subDays(now, 59)),
        to: endOfDay(subDays(now, 30)),
      };
    case "90d":
      return {
        from: startOfDay(subDays(now, 179)),
        to: endOfDay(subDays(now, 90)),
      };
    case "month":
    default: {
      const prevMonth = subMonths(now, 1);
      return {
        from: startOfMonth(prevMonth),
        to: endOfMonth(prevMonth),
      };
    }
  }
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

async function buildMetricsForRange(
  tenantId: string,
  from: Date,
  to: Date
): Promise<ReportMetrics> {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const timeZone = getTenantTimezone(settings?.timeZone);

  const [payments, refunds, appointments, newClients, barberCount] = await Promise.all([
    prisma.salePayment.findMany({
      where: {
        tenantId,
        status: { in: ["COMPLETED", "REFUNDED"] },
        createdAt: { gte: from, lte: to },
      },
      select: { amount: true, method: true },
    }),
    prisma.saleRefund.findMany({
      where: {
        tenantId,
        createdAt: { gte: from, lte: to },
      },
      select: { amount: true, payment: { select: { method: true } } },
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

  // Net revenue = payments completed (or later refunded) with createdAt in range,
  // minus refunds issued in range — refunds affect the period they happened in,
  // not the original payment's period.
  const grossRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const refundedTotal = refunds.reduce((s, r) => s + Number(r.amount), 0);
  const revenueTotal = grossRevenue - refundedTotal;

  const byMethod: Record<string, number> = {};
  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  }
  for (const r of refunds) {
    const method = r.payment?.method;
    if (!method) continue;
    byMethod[method] = (byMethod[method] ?? 0) - Number(r.amount);
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

export async function getReportMetrics(
  tenantId: string,
  period: ReportPeriod = "30d"
): Promise<ReportMetrics> {
  const { from, to } = resolvePeriod(period);
  return buildMetricsForRange(tenantId, from, to);
}

function bucketKey(date: Date, period: ReportPeriod): string {
  if (period === "7d") {
    return format(date, "EEE dd/MM", { locale: ptBR });
  }
  if (period === "month") {
    return format(date, "'Sem' w", { locale: ptBR });
  }
  return format(date, "dd/MM", { locale: ptBR });
}

export async function getReportDashboardData(
  tenantId: string,
  period: ReportPeriod = "30d"
): Promise<ReportDashboardData> {
  const { from, to } = resolvePeriod(period);
  const prevRange = resolvePreviousPeriod(period);

  const [metrics, previous, detailAppointments] = await Promise.all([
    buildMetricsForRange(tenantId, from, to),
    buildMetricsForRange(tenantId, prevRange.from, prevRange.to),
    prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: from, lte: to },
        status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
      },
      select: {
        status: true,
        scheduledAt: true,
        service: { select: { name: true } },
        barber: { select: { name: true } },
      },
    }),
  ]);

  const serviceCounts = new Map<string, number>();
  const barberCounts = new Map<string, number>();
  const evolutionBuckets = new Map<string, { cancelled: number; noShow: number }>();

  for (const appt of detailAppointments) {
    const key = bucketKey(appt.scheduledAt, period);
    if (!evolutionBuckets.has(key)) {
      evolutionBuckets.set(key, { cancelled: 0, noShow: 0 });
    }
    const bucket = evolutionBuckets.get(key)!;
    if (appt.status === "CANCELLED") bucket.cancelled += 1;
    if (appt.status === "NO_SHOW") bucket.noShow += 1;

    if (appt.status === "COMPLETED") {
      const serviceName = appt.service.name;
      serviceCounts.set(serviceName, (serviceCounts.get(serviceName) ?? 0) + 1);
      const barberName = appt.barber?.name ?? "Sem profissional";
      barberCounts.set(barberName, (barberCounts.get(barberName) ?? 0) + 1);
    }
  }

  const topServices = [...serviceCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const barberPerformance = [...barberCounts.entries()]
    .map(([name, completed]) => ({ name, completed }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  const statusEvolution = [...evolutionBuckets.entries()].map(([label, data]) => ({
    label,
    cancelled: data.cancelled,
    noShow: data.noShow,
  }));

  const hasPreviousData =
    previous.revenue.paymentCount > 0 ||
    previous.appointments.total > 0 ||
    previous.clients.newClients > 0;

  return {
    metrics,
    previous: hasPreviousData ? previous : null,
    topServices,
    barberPerformance,
    statusEvolution,
  };
}

export function metricsToCsv(metrics: ReportMetrics): string {
  const rows = [
    ["Métrica", "Valor"],
    ["Período início", metrics.period.from],
    ["Período fim", metrics.period.to],
    ["Receita líquida (pagamentos - estornos)", metrics.revenue.total.toFixed(2)],
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
