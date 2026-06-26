import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { fetchTodayStats, fetchClientsAtRisk } from "@/lib/queries";
import { AppShell } from "@/components/layout/sidebar";
import { StatCard, Card } from "@/components/ui/card";
import {
  NewAppointmentModal,
  AppointmentActions,
  StatusBadge,
  formatTime,
  formatDateLong,
} from "@/components/appointments/appointment-components";
import { serializeServices } from "@/lib/serialize";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, Users, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { SendSingleButton } from "@/components/whatsapp/whatsapp-panel";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  const tenantId = requireTenantId(user);
  const { appointments, revenue, clientsServed } = await fetchTodayStats(user);
  const atRisk = await fetchClientsAtRisk(tenantId);

  const [services, barbers] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.user.findMany({
      where: { tenantId, role: "BARBER", active: true },
      select: { id: true, name: true },
    }),
  ]);

  const freeSlots = [];
  const occupiedHours = new Set(
    appointments
      .filter((a) => a.status !== "CANCELLED")
      .map((a) => formatTime(a.scheduledAt))
  );

  for (let h = 8; h <= 19; h++) {
    for (const m of [0, 30]) {
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (!occupiedHours.has(time)) {
        freeSlots.push(time);
      }
    }
  }

  return (
    <AppShell>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-amber-400 font-medium">Hoje</p>
            <h1 className="text-2xl font-bold text-white capitalize">
              {formatDateLong(new Date())}
            </h1>
          </div>
          <NewAppointmentModal
            services={serializeServices(services)}
            barbers={barbers}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Faturamento hoje"
            value={formatCurrency(revenue)}
            icon={<DollarSign className="h-5 w-5" />}
            accent
          />
          <StatCard
            label="Clientes atendidos"
            value={clientsServed}
            icon={<Users className="h-5 w-5" />}
          />
        </div>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Agenda de hoje</h2>
          <div className="space-y-2">
            {appointments.length === 0 && (
              <p className="py-8 text-center text-zinc-500">Nenhum horário hoje</p>
            )}
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-amber-400 tabular-nums">
                    {formatTime(apt.scheduledAt)}
                  </span>
                  <div>
                    <p className="font-medium text-white">{apt.client.name}</p>
                    <p className="text-sm text-zinc-500">
                      {apt.service.name}
                      {apt.barber && ` · ${apt.barber.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={apt.status} />
                  <AppointmentActions id={apt.id} status={apt.status} />
                </div>
              </div>
            ))}

            {freeSlots.slice(0, 3).map((time) => (
              <div
                key={time}
                className="flex items-center gap-4 rounded-xl border border-dashed border-zinc-800 px-4 py-3 opacity-60"
              >
                <span className="text-lg font-bold text-zinc-600 tabular-nums">{time}</span>
                <span className="text-sm text-zinc-600">Livre</span>
              </div>
            ))}
          </div>
        </Card>

        {atRisk.length > 0 && (
          <Card className="border-orange-500/20">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">
                Clientes para retorno ({atRisk.length})
              </h2>
            </div>
            <p className="mb-4 text-sm text-zinc-400">
              Passaram do intervalo ideal desde o último corte — envie WhatsApp agora!
            </p>
            {isTenantAdmin(user) && (
              <Link
                href="/whatsapp"
                className="mb-4 inline-block text-sm text-green-400 hover:underline"
              >
                → Ir para cobrança em massa
              </Link>
            )}
            <div className="space-y-2">
              {atRisk.slice(0, 5).map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{client.name}</p>
                    <p className="text-xs text-zinc-500">
                      {client.daysSince} dias · ideal a cada {client.returnDays}d
                    </p>
                  </div>
                  {isTenantAdmin(user) ? (
                    <SendSingleButton clientId={client.id} />
                  ) : (
                    <span className="text-xs text-orange-400">Aguardando retorno</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
