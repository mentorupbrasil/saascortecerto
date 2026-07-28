import "server-only";

import { prisma } from "@/lib/prisma";
import { canUseAutoWhatsApp } from "@/lib/plan-pricing";
import {
  renderMessageTemplate,
  sendWhatsAppText,
} from "@/lib/whatsapp";
import type { WhatsAppMessageStatus, WhatsAppMessageType } from "@prisma/client";
import { getClientsDueForReturn } from "@/lib/whatsapp/return-queue";

async function getTenantPlan(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  return tenant?.plan ?? "FREE";
}

async function assertAutoWhatsApp(tenantId: string) {
  const plan = await getTenantPlan(tenantId);
  if (!canUseAutoWhatsApp(plan)) {
    throw new Error(
      "Disparo automático disponível no plano Pro. No plano Básico, use o botão para abrir o WhatsApp manualmente."
    );
  }
}

export async function processBulkReturnForTenant(tenantId: string) {
  await assertAutoWhatsApp(tenantId);
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (!settings) throw new Error("Configurações não encontradas");

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const clients = await getClientsDueForReturn(tenantId);

  let sent = 0;
  let failed = 0;
  let simulated = 0;

  for (const client of clients) {
    const message = renderMessageTemplate(settings.whatsappReturnTemplate, {
      nome: client.name.split(" ")[0],
      dias: client.daysSince,
      barbearia: tenant?.name ?? "nossa barbearia",
    });

    const result = await sendWhatsAppText(settings, client.phone, message);

    let status: WhatsAppMessageStatus = "FAILED";
    if (result.simulated) {
      status = "SIMULATED";
      simulated++;
    } else if (result.success) {
      status = "SENT";
      sent++;
    } else {
      failed++;
    }

    await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        clientId: client.id,
        phone: client.phone,
        message,
        type: "RETURN" as WhatsAppMessageType,
        status,
        error: result.error,
        sentAt: result.success ? new Date() : null,
      },
    });

    if (result.success) {
      await prisma.client.update({
        where: { id: client.id },
        data: { lastReturnMessageAt: new Date() },
      });
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  await prisma.tenantSettings.update({
    where: { tenantId },
    data: { lastBulkSendAt: new Date() },
  });

  return {
    total: clients.length,
    sent,
    failed,
    simulated,
  };
}

export async function runAutoReturnCron() {
  const tenants = await prisma.tenant.findMany({
    where: {
      plan: "CLUBE",
      active: true,
      settings: {
        autoReturnEnabled: true,
        whatsappEnabled: true,
      },
    },
    select: { id: true },
  });

  const results = [];
  for (const { id: tenantId } of tenants) {
    try {
      const result = await processBulkReturnForTenant(tenantId);
      results.push({ tenantId, ...result });
    } catch (err) {
      results.push({
        tenantId,
        error: err instanceof Error ? err.message : "Erro",
      });
    }
  }

  return results;
}
