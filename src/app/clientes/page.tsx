import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, requireTenantId } from "@/lib/auth-utils";
import { hasPermission, requireAuthenticatedUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { ClientsList } from "@/components/clients/clients-list";
import { serializeServices } from "@/lib/serialize";

export default async function ClientesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  const tenantId = requireTenantId(user);
  const authUser = await requireAuthenticatedUser();

  const canManage = hasPermission(authUser, "clients:manage");
  const canSchedule = hasPermission(authUser, "agenda:edit");
  const canSell = hasPermission(authUser, "finance:sell");

  const [clients, services, barbers] = await Promise.all([
    prisma.client.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            appointments: true,
            memberships: { where: { status: "ACTIVE" } },
          },
        },
      },
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
    <TenantAppShell>
      <div className="animate-fade-in">
        <ClientsList
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            birthday: c.birthday?.toISOString() ?? null,
            notes: c.notes,
            lastVisitAt: c.lastVisitAt?.toISOString() ?? null,
            returnDays: c.returnDays,
            photoUrl: c.photoUrl,
            whatsappOptIn: c.whatsappOptIn,
            appointmentCount: c._count.appointments,
            isClubMember: c._count.memberships > 0,
          }))}
          services={serializeServices(services)}
          barbers={barbers}
          permissions={{ canManage, canSchedule, canSell }}
        />
      </div>
    </TenantAppShell>
  );
}
