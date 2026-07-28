import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, requireTenantId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { serializeServices } from "@/lib/serialize";
import { canAccessComandas } from "@/lib/nav-config";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { NewAppointmentModal } from "@/components/appointments/appointment-components";
import { AgendaWeekNav } from "@/components/agenda/agenda-week-nav";
import { AgendaSection } from "@/components/agenda/agenda-section";
import { ShareBookingLink } from "@/components/agenda/share-booking-link";
import { PublicBookingSettings } from "@/components/agenda/public-booking-settings";
import { OnlineBookingsPanel } from "@/components/agenda/online-bookings-panel";
import { PageHeader } from "@/components/ui/page-chrome";
import { getAgendaOnlineItems } from "@/lib/public-booking-actions";
import { getPublicBookingSettingsDto } from "@/lib/public-booking-settings-dto";
import { toDateKey } from "@/lib/date-format";
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
  const currentDateKey = params.date ?? toDateKey(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const daysRaw = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const filter = user.role === "BARBER" ? { barberId: user.id } : {};

  const [appointments, services, barbers, settings, tenant, onlineItems] = await Promise.all([
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
        sales: {
          where: { status: { in: ["DRAFT", "OPEN", "CLOSED"] } },
          select: { id: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
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
    getAgendaOnlineItems(),
  ]);

  const bookingSettings = getPublicBookingSettingsDto(settings);
  const showComandas = canAccessComandas(user.role);

  const days = daysRaw.map((day) => ({
    date: toDateKey(day),
    label: format(day, "EEE d", { locale: ptBR }),
    isToday: isSameDay(day, new Date()),
  }));

  const calendarAppointments = appointments.map((apt) => ({
    id: apt.id,
    scheduledAt: apt.scheduledAt.toISOString(),
    duration: apt.duration,
    status: apt.status,
    clientName: apt.client.name,
    clientPhone: apt.client.phone,
    clientId: apt.clientId,
    serviceId: apt.serviceId,
    serviceName: apt.service.name,
    barberId: apt.barberId,
    barberName: apt.barber?.name,
    bookedOnline: apt.bookedOnline,
    notes: apt.notes,
    origin: apt.origin,
    paymentMethod: apt.paymentMethod,
    saleId: apt.sales[0]?.id ?? null,
  }));

  const openTime = settings?.openTime ?? "07:00";
  const closeTime = settings?.closeTime ?? "22:00";

  return (
    <TenantAppShell>
      <div className="animate-fade-in space-y-4">
        <PageHeader
          title="Agenda"
          description={`Semana · ${openTime} às ${closeTime}`}
          action={
            <NewAppointmentModal
              services={serializeServices(services)}
              barbers={barbers}
            />
          }
        />

        <div className="hidden lg:block">
          <AgendaWeekNav currentDate={currentDate.toISOString()} />
        </div>

        <OnlineBookingsPanel
          pendingCheckouts={onlineItems.pendingCheckouts}
          onlineAppointments={onlineItems.onlineAppointments}
        />

        {tenant && (
          <ShareBookingLink
            slug={tenant.slug}
            enabled={settings?.publicBookingEnabled ?? true}
          />
        )}

        <AgendaSection
          days={days}
          appointments={calendarAppointments}
          openTime={openTime}
          closeTime={closeTime}
          barbers={barbers}
          services={serializeServices(services)}
          canAccessComandas={showComandas}
          initialDate={currentDateKey}
        />

        {tenant && (
          <PublicBookingSettings
            enabled={bookingSettings.enabled}
            notifyPhone={bookingSettings.notifyPhone ?? tenant.phone}
            requirePixPayment={bookingSettings.requirePixPayment}
            pixKey={bookingSettings.pixKey}
            pixHolderName={bookingSettings.pixHolderName}
            pixCity={bookingSettings.pixCity}
            mercadoPagoConfigured={bookingSettings.mercadoPagoConfigured}
          />
        )}
      </div>
    </TenantAppShell>
  );
}
