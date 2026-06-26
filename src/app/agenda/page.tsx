import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, requireTenantId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { serializeServices } from "@/lib/serialize";
import { AppShell } from "@/components/layout/sidebar";
import { Card } from "@/components/ui/card";
import {
  NewAppointmentModal,
  AppointmentActions,
} from "@/components/appointments/appointment-components";
import { StatusBadge } from "@/components/appointments/status-badge";
import { formatTime } from "@/lib/date-format";
import { AgendaWeekNav } from "@/components/agenda/agenda-week-nav";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  const tenantId = requireTenantId(user);
  const params = await searchParams;
  const currentDate = params.date ? parseISO(params.date) : new Date();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const filter =
    user.role === "BARBER" ? { barberId: user.id } : {};

  const [appointments, services, barbers] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: weekStart, lte: weekEnd },
        status: { not: "CANCELLED" },
        ...filter,
      },
      include: {
        client: true,
        service: true,
        barber: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.service.findMany({
      where: { tenantId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.user.findMany({
      where: { tenantId, role: "BARBER", active: true },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <AppShell>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Agenda</h1>
            <p className="text-sm text-zinc-400">Visão semanal estilo Google Agenda</p>
          </div>
          <NewAppointmentModal
            services={serializeServices(services)}
            barbers={barbers}
          />
        </div>

        <AgendaWeekNav currentDate={currentDate.toISOString()} />

        <div className="grid gap-3">
          {days.map((day) => {
            const dayAppointments = appointments.filter((a) =>
              isSameDay(a.scheduledAt, day)
            );
            const isToday = isSameDay(day, new Date());

            return (
              <Card
                key={day.toISOString()}
                className={isToday ? "border-amber-500/30" : undefined}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold capitalize ${
                      isToday ? "text-amber-400" : "text-white"
                    }`}
                  >
                    {format(day, "EEE, d MMM", { locale: ptBR })}
                  </span>
                  {isToday && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                      Hoje
                    </span>
                  )}
                </div>

                {dayAppointments.length === 0 ? (
                  <p className="text-sm text-zinc-600 py-2">Sem horários</p>
                ) : (
                  <div className="space-y-2">
                    {dayAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-amber-400 tabular-nums text-sm">
                            {formatTime(apt.scheduledAt)}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {apt.client.name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {apt.service.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={apt.status} />
                          <AppointmentActions id={apt.id} status={apt.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
