import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth-utils";
import { getAppointmentFilter } from "@/lib/auth-utils";
import { endOfDay, startOfDay } from "date-fns";

export async function fetchTodayStats(user: SessionUser) {
  const tenantId = user.tenantId!;
  const filter = getAppointmentFilter(user);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      scheduledAt: { gte: todayStart, lte: todayEnd },
      ...filter,
    },
    include: {
      client: true,
      service: true,
      barber: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const revenue = completed.reduce((sum, a) => sum + Number(a.price), 0);

  return {
    appointments,
    revenue,
    clientsServed: completed.length,
  };
}

export async function fetchClientsAtRisk(tenantId: string) {
  const clients = await prisma.client.findMany({
    where: { tenantId, lastVisitAt: { not: null } },
  });

  const now = new Date();
  return clients
    .filter((c) => {
      if (!c.lastVisitAt) return false;
      const daysSince = Math.floor(
        (now.getTime() - c.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSince >= c.returnDays;
    })
    .map((c) => ({
      ...c,
      daysSince: Math.floor(
        (now.getTime() - (c.lastVisitAt?.getTime() ?? 0)) / (1000 * 60 * 60 * 24)
      ),
    }));
}
