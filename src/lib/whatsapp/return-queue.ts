import "server-only";

import { prisma } from "@/lib/prisma";
import { buildWhatsAppUrl, daysSince, renderMessageTemplate } from "@/lib/whatsapp";

export async function getClientsDueForReturn(tenantId: string) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const defaultInterval = settings?.returnMessageDays ?? 20;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  const clients = await prisma.client.findMany({
    where: { tenantId, whatsappOptIn: true },
  });

  return clients
    .filter((client) => {
      const interval = client.returnDays || defaultInterval;
      const referenceDate = client.lastReturnMessageAt ?? client.lastVisitAt;
      if (!referenceDate) return false;

      const days = daysSince(referenceDate);
      if (client.lastReturnMessageAt) {
        return days >= interval;
      }
      if (client.lastVisitAt) {
        return daysSince(client.lastVisitAt) >= interval;
      }
      return false;
    })
    .map((client) => {
      const referenceDate = client.lastReturnMessageAt ?? client.lastVisitAt!;
      const daysSinceRef = daysSince(referenceDate);
      const message = renderMessageTemplate(
        settings?.whatsappReturnTemplate ??
          "Fala {nome}! Já faz {dias} dias do seu último corte na {barbearia}. Bora marcar? ✂️",
        {
          nome: client.name.split(" ")[0],
          dias: daysSinceRef,
          barbearia: tenant?.name ?? "nossa barbearia",
        }
      );

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        daysSince: daysSinceRef,
        message,
        waUrl: buildWhatsAppUrl(client.phone, message),
        tenantName: tenant?.name ?? "Barbearia",
      };
    });
}
