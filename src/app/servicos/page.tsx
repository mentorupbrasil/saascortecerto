import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { ServicesList } from "@/components/services/services-list";

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
      <div className="animate-fade-in">
        <ServicesList
          services={services.map((service) => ({
            id: service.id,
            name: service.name,
            price: Number(service.price),
            duration: service.duration,
            active: service.active,
          }))}
        />
      </div>
    </TenantAppShell>
  );
}
