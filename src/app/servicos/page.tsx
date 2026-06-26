import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { Card } from "@/components/ui/card";
import {
  ServiceFormModal,
  EditServiceModal,
  ToggleServiceButton,
} from "@/components/services/service-form";
import { formatCurrency } from "@/lib/utils";

export default async function ServicosPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");
  if (!isTenantAdmin(user)) redirect("/dashboard");

  const tenantId = requireTenantId(user);

  const services = await prisma.service.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <TenantAppShell>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Serviços</h1>
            <p className="text-sm text-zinc-400">Edite nomes, valores e duração</p>
          </div>
          <ServiceFormModal />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((service) => (
            <Card
              key={service.id}
              className={!service.active ? "opacity-50" : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{service.name}</p>
                  <p className="mt-1 text-lg font-bold text-amber-400">
                    {formatCurrency(Number(service.price))}
                  </p>
                  <p className="text-sm text-zinc-500">{service.duration} min</p>
                  <EditServiceModal
                    service={{
                      id: service.id,
                      name: service.name,
                      price: Number(service.price),
                      duration: service.duration,
                      active: service.active,
                    }}
                  />
                </div>
                <ToggleServiceButton id={service.id} active={service.active} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </TenantAppShell>
  );
}
