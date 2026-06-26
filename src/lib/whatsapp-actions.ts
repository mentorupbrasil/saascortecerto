"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import {
  daysSince,
  renderMessageTemplate,
  sendWhatsAppText,
} from "@/lib/whatsapp";
import { z } from "zod";
import type { WhatsAppMessageStatus, WhatsAppMessageType } from "@prisma/client";

const settingsSchema = z.object({
  whatsappEnabled: z.coerce.boolean().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  whatsappAccessToken: z.string().optional(),
  whatsappReturnTemplate: z.string().min(10),
  autoReturnEnabled: z.coerce.boolean().optional(),
  returnMessageDays: z.coerce.number().min(7).max(90),
});

export async function getWhatsAppSettings() {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  });

  return { tenant, settings };
}

export async function updateWhatsAppSettings(formData: FormData) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  const parsed = settingsSchema.parse({
    whatsappEnabled: formData.get("whatsappEnabled") === "on",
    whatsappPhoneNumberId: formData.get("whatsappPhoneNumberId") || undefined,
    whatsappAccessToken: formData.get("whatsappAccessToken") || undefined,
    whatsappReturnTemplate: formData.get("whatsappReturnTemplate"),
    autoReturnEnabled: formData.get("autoReturnEnabled") === "on",
    returnMessageDays: formData.get("returnMessageDays") || 20,
  });

  const existing = await prisma.tenantSettings.findUnique({ where: { tenantId } });

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      whatsappEnabled: parsed.whatsappEnabled ?? false,
      whatsappReturnTemplate: parsed.whatsappReturnTemplate,
      autoReturnEnabled: parsed.autoReturnEnabled ?? false,
      returnMessageDays: parsed.returnMessageDays,
      whatsappPhoneNumberId: parsed.whatsappPhoneNumberId ?? null,
      whatsappAccessToken: parsed.whatsappAccessToken ?? null,
    },
    update: {
      whatsappEnabled: parsed.whatsappEnabled ?? false,
      whatsappReturnTemplate: parsed.whatsappReturnTemplate,
      autoReturnEnabled: parsed.autoReturnEnabled ?? false,
      returnMessageDays: parsed.returnMessageDays,
      ...(parsed.whatsappPhoneNumberId
        ? { whatsappPhoneNumberId: parsed.whatsappPhoneNumberId }
        : {}),
      ...(parsed.whatsappAccessToken
        ? { whatsappAccessToken: parsed.whatsappAccessToken }
        : existing?.whatsappAccessToken
          ? { whatsappAccessToken: existing.whatsappAccessToken }
          : {}),
    },
  });

  revalidatePath("/whatsapp");
  return { success: true };
}

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
      return {
        ...client,
        daysSince: daysSince(referenceDate),
        tenantName: tenant?.name ?? "Barbearia",
      };
    });
}

export async function getReturnPreview() {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);
  return getClientsDueForReturn(tenantId);
}

export async function sendBulkReturnMessages() {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  const result = await processBulkReturnForTenant(tenantId);
  revalidatePath("/whatsapp");
  revalidatePath("/dashboard");
  return result;
}

export async function sendSingleReturnMessage(clientId: string) {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
  });
  if (!client) throw new Error("Cliente não encontrado");

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  if (!settings) throw new Error("Configure o WhatsApp primeiro");

  const days =
    client.lastVisitAt != null
      ? daysSince(client.lastVisitAt)
      : settings.returnMessageDays;

  const message = renderMessageTemplate(settings.whatsappReturnTemplate, {
    nome: client.name.split(" ")[0],
    dias: days,
    barbearia: tenant?.name ?? "nossa barbearia",
  });

  const sent = await sendWhatsAppText(settings, client.phone, message);

  await prisma.whatsAppMessage.create({
    data: {
      tenantId,
      clientId: client.id,
      phone: client.phone,
      message,
      type: "RETURN",
      status: sent.simulated ? "SIMULATED" : sent.success ? "SENT" : "FAILED",
      error: sent.error,
      sentAt: sent.success ? new Date() : null,
    },
  });

  if (sent.success) {
    await prisma.client.update({
      where: { id: client.id },
      data: { lastReturnMessageAt: new Date() },
    });
  }

  revalidatePath("/whatsapp");
  revalidatePath("/dashboard");
  return sent;
}

export async function processBulkReturnForTenant(tenantId: string) {
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

export async function getWhatsAppMessageLog(limit = 50) {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  return prisma.whatsAppMessage.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function runAutoReturnCron() {
  const tenants = await prisma.tenantSettings.findMany({
    where: { autoReturnEnabled: true, whatsappEnabled: true },
    select: { tenantId: true },
  });

  const results = [];
  for (const { tenantId } of tenants) {
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
