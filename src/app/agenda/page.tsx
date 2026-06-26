import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, requireTenantId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { serializeServices } from "@/lib/serialize";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { NewAppointmentModal } from "@/components/appointments/appointment-components";
import { AgendaWeekNav } from "@/components/agenda/agenda-week-nav";
import { AgendaCalendarGrid } from "@/components/agenda/agenda-calendar-grid";
import { ShareBookingLink } from "@/components/agenda/share-booking-link";
import { PublicBookingSettings } from "@/components/agenda/public-booking-settings";
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
  const daysRaw = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const filter = user.role === "BARBER" ? { barberId: user.id } : {};

  const [appointments, services, barbers, settings, tenant] = await Promise.all([
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
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, phone: true },
    }),
  ]);

  const days = daysRaw.map((day) => ({
    date: day.toISOString(),
    label: format(day, "EEE d", { locale: ptBR }),
    isToday: isSameDay(day, new Date()),
  }));

  const calendarAppointments = appointments.map((apt) => ({
    id: apt.id,
    scheduledAt: apt.scheduledAt.toISOString(),
    duration: apt.duration,
    status: apt.status,
    clientName: apt.client.name,
    serviceName: apt.service.name,
    barberName: apt.barber?.name,
    bookedOnline: apt.bookedOnline,
  }));

  return (
    <TenantAppShell>
      <div className="animate-fade-in space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Agenda</h1>
            <p className="text-sm text-zinc-400">
              Grade semanal · {settings?.openTime ?? "08:00"} às{" "}
              {settings?.closeTime ?? "20:00"}
            </p>
          </div>
          <NewAppointmentModal
            services={serializeServices(services)}
            barbers={barbers}
          />
        </div>

        <AgendaWeekNav currentDate={currentDate.toISOString()} />

        {tenant && (
          <ShareBookingLink
            slug={tenant.slug}
            enabled={settings?.publicBookingEnabled ?? true}
          />
        )}

        <AgendaCalendarGrid days={days} appointments={calendarAppointments} />

        {tenant && (
          <PublicBookingSettings
            enabled={settings?.publicBookingEnabled ?? true}
            notifyPhone={settings?.bookingNotifyPhone ?? tenant.phone}
          />
        )}
      </div>
    </TenantAppShell>
  );
}
