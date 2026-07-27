import "server-only";

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import type { AuthenticatedUser } from "@/lib/authz";
import { assertTenantResource, hasPermission } from "@/lib/authz";

const ANONYMOUS_NAME = "Cliente anonimizado";
const ANONYMOUS_PHONE_PREFIX = "000000";

export async function anonymizeClient(
  user: AuthenticatedUser & { tenantId: string },
  clientId: string
) {
  if (!hasPermission(user, "clients:manage")) {
    throw new Error("Sem permissão para anonimizar cliente");
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId: user.tenantId },
    select: {
      id: true,
      tenantId: true,
      phone: true,
      _count: {
        select: {
          sales: true,
          appointments: true,
        },
      },
    },
  });

  if (!client) throw new Error("Cliente não encontrado");
  assertTenantResource(user, client.tenantId);

  const anonPhone = `${ANONYMOUS_PHONE_PREFIX}${client.id.slice(-8)}`;

  await prisma.$transaction(async (tx) => {
    await tx.clientConsent.updateMany({
      where: { clientId },
      data: { granted: false, revokedAt: new Date() },
    });

    await tx.clientTagAssignment.deleteMany({ where: { clientId } });

    await tx.client.update({
      where: { id: clientId },
      data: {
        name: ANONYMOUS_NAME,
        phone: anonPhone,
        birthday: null,
        photoUrl: null,
        notes: null,
        whatsappOptIn: false,
      },
    });

    await tx.waitlistEntry.updateMany({
      where: { clientId },
      data: {
        clientName: ANONYMOUS_NAME,
        clientPhone: anonPhone,
        notes: null,
        status: "CANCELLED",
      },
    });
  });

  await writeAuditLog({
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: "client.anonymized",
    entityType: "Client",
    entityId: clientId,
    metadata: {
      preservedSales: client._count.sales,
      preservedAppointments: client._count.appointments,
    },
  });

  return {
    success: true,
    preservedSales: client._count.sales,
    preservedAppointments: client._count.appointments,
  };
}
