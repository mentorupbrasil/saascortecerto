import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, requireTenantId } from "@/lib/auth-utils";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { WaitlistPanel } from "@/components/waitlist/waitlist-panel";
import {
  getWaitlistEntriesAction,
  getWaitlistFormOptionsAction,
} from "@/lib/waitlist-actions";

export default async function ListaEsperaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  requireTenantId(user);

  const [entries, formOptions] = await Promise.all([
    getWaitlistEntriesAction(),
    getWaitlistFormOptionsAction(),
  ]);

  const serialized = (entries ?? []).map((e) => ({
    id: e.id,
    clientName: e.clientName,
    clientPhone: e.clientPhone,
    status: e.status,
    priority: e.priority,
    preferredDates: e.preferredDates,
    offerExpiresAt: e.offerExpiresAt?.toISOString() ?? null,
    offeredSlotAt: e.offeredSlotAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    service: e.service,
    barber: e.barber,
  }));

  return (
    <TenantAppShell>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lista de espera</h1>
          <p className="text-sm text-zinc-400">
            Gerencie clientes aguardando horários — ofertas expiram automaticamente
          </p>
        </div>
        {formOptions && (
          <WaitlistPanel entries={serialized} formOptions={formOptions} />
        )}
      </div>
    </TenantAppShell>
  );
}
