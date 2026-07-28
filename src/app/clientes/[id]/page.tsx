import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, requireTenantId } from "@/lib/auth-utils";
import { hasPermission, requireAuthenticatedUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { ClientDetailView } from "@/components/clients/client-detail-view";
import { serializeServices } from "@/lib/serialize";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  const tenantId = requireTenantId(user);
  const { id } = await params;

  const authUser = await requireAuthenticatedUser();

  const canManage = hasPermission(authUser, "clients:manage");
  const canSchedule = hasPermission(authUser, "agenda:edit");
  const canSell = hasPermission(authUser, "finance:sell");
  const canViewFinance =
    hasPermission(authUser, "finance:view") || hasPermission(authUser, "finance:sell");

  const [client, services, barbers, sales] = await Promise.all([
    prisma.client.findFirst({
      where: { id, tenantId },
      include: {
        appointments: {
          orderBy: { scheduledAt: "desc" },
          take: 30,
          include: {
            service: { select: { name: true } },
            barber: { select: { name: true } },
          },
        },
        memberships: {
          where: { status: "ACTIVE" },
          include: { plan: { select: { name: true } } },
          take: 1,
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
    canViewFinance
      ? prisma.sale.findMany({
          where: { tenantId, clientId: id },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { items: { select: { id: true } } },
        })
      : Promise.resolve([]),
  ]);

  if (!client) notFound();

  const activeMembership = client.memberships[0];

  return (
    <TenantAppShell>
      <ClientDetailView
        client={{
          id: client.id,
          name: client.name,
          phone: client.phone,
          birthday: client.birthday?.toISOString() ?? null,
          notes: client.notes,
          lastVisitAt: client.lastVisitAt?.toISOString() ?? null,
          returnDays: client.returnDays,
          photoUrl: client.photoUrl,
          whatsappOptIn: client.whatsappOptIn,
          isClubMember: client.memberships.length > 0,
          clubPlanName: activeMembership?.plan.name ?? null,
          appointments: client.appointments.map((a) => ({
            id: a.id,
            scheduledAt: a.scheduledAt.toISOString(),
            status: a.status,
            serviceName: a.service.name,
            barberName: a.barber?.name ?? null,
            price: Number(a.price),
          })),
          sales: sales.map((s) => ({
            id: s.id,
            status: s.status,
            total: Number(s.total),
            createdAt: s.createdAt.toISOString(),
            itemCount: s.items.length,
          })),
        }}
        services={serializeServices(services)}
        barbers={barbers}
        permissions={{ canManage, canSchedule, canSell, canViewFinance }}
      />
    </TenantAppShell>
  );
}
