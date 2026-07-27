import "server-only";

import { prisma } from "@/lib/prisma";
import {
  assertTenantResource,
  hasPermission,
  type AuthenticatedUser,
} from "@/lib/authz";

export async function exportClientData(
  user: AuthenticatedUser & { tenantId: string },
  clientId: string
) {
  if (
    !hasPermission(user, "reports:export") &&
    !hasPermission(user, "clients:manage")
  ) {
    throw new Error("Sem permissão para exportar dados do cliente");
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId: user.tenantId },
    include: {
      consents: true,
      tagAssignments: { include: { tag: true } },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 100,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          price: true,
          duration: true,
          service: { select: { name: true } },
          barber: { select: { name: true } },
        },
      },
      memberships: {
        include: { plan: { select: { name: true, planType: true } } },
      },
      sales: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          total: true,
          status: true,
          createdAt: true,
          payments: {
            select: { method: true, amount: true, status: true },
          },
        },
      },
      loyaltyAccount: {
        include: {
          ledger: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      },
    },
  });

  if (!client) throw new Error("Cliente não encontrado");
  assertTenantResource(user, client.tenantId);

  return {
    exportedAt: new Date().toISOString(),
    tenantId: user.tenantId,
    client: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      birthday: client.birthday?.toISOString() ?? null,
      notes: client.notes,
      whatsappOptIn: client.whatsappOptIn,
      lastVisitAt: client.lastVisitAt?.toISOString() ?? null,
      returnDays: client.returnDays,
      createdAt: client.createdAt.toISOString(),
      consents: client.consents.map((c) => ({
        type: c.type,
        granted: c.granted,
        grantedAt: c.grantedAt.toISOString(),
        revokedAt: c.revokedAt?.toISOString() ?? null,
        source: c.source,
      })),
      tags: client.tagAssignments.map((a) => a.tag.name),
      appointments: client.appointments,
      memberships: client.memberships.map((m) => ({
        plan: m.plan.name,
        planType: m.plan.planType,
        status: m.status,
        startedAt: m.startedAt.toISOString(),
        visitsUsedThisPeriod: m.visitsUsedThisPeriod,
        totalVisitsUsed: m.totalVisitsUsed,
      })),
      sales: client.sales,
      loyalty: client.loyaltyAccount
        ? {
            points: client.loyaltyAccount.points,
            ledger: client.loyaltyAccount.ledger,
          }
        : null,
    },
  };
}
