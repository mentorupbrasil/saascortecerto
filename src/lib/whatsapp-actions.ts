"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import { canUseAutoWhatsApp } from "@/lib/plan-pricing";
import {
  credentialConfigured,
  prepareCredentialForStorage,
} from "@/lib/crypto/credentials";
import {
  daysSince,
  renderMessageTemplate,
  sendWhatsAppText,
} from "@/lib/whatsapp";
import { processBulkReturnForTenant } from "@/lib/whatsapp/cron";
import { getClientsDueForReturn } from "@/lib/whatsapp/return-queue";
import { z } from "zod";
import type { Plan } from "@prisma/client";

async function getTenantPlan(tenantId: string): Promise<Plan> {
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
      "Disparo automático disponível no plano Completo (R$ 59,90/mês). No plano Pro, use o botão para abrir o WhatsApp manualmente."
    );
  }
}

const settingsSchema = z.object({
  whatsappEnabled: z.coerce.boolean().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  newWhatsAppAccessToken: z.string().optional(),
  whatsappReturnTemplate: z.string().min(10),
  autoReturnEnabled: z.coerce.boolean().optional(),
  returnMessageDays: z.coerce.number().min(7).max(90),
});

export type WhatsAppSettingsDto = {
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappReturnTemplate: string;
  autoReturnEnabled: boolean;
  returnMessageDays: number;
  lastBulkSendAt: Date | null;
  whatsappTokenConfigured: boolean;
};

export async function getWhatsAppSettings() {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, plan: true },
  });

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  });

  const plan = tenant?.plan ?? "FREE";

  return {
    tenant: { name: tenant?.name ?? "", plan },
    plan,
    settings: settings
      ? {
          whatsappEnabled: settings.whatsappEnabled,
          whatsappPhoneNumberId: settings.whatsappPhoneNumberId,
          whatsappReturnTemplate: settings.whatsappReturnTemplate,
          autoReturnEnabled: settings.autoReturnEnabled,
          returnMessageDays: settings.returnMessageDays,
          lastBulkSendAt: settings.lastBulkSendAt,
          whatsappTokenConfigured: credentialConfigured(settings.whatsappAccessToken),
        }
      : null,
  };
}

export async function updateWhatsAppSettings(formData: FormData) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);
  const plan = await getTenantPlan(tenantId);
  const autoAllowed = canUseAutoWhatsApp(plan);

  const parsed = settingsSchema.parse({
    whatsappEnabled: formData.get("whatsappEnabled") === "on",
    whatsappPhoneNumberId: autoAllowed
      ? formData.get("whatsappPhoneNumberId") || undefined
      : undefined,
    newWhatsAppAccessToken: autoAllowed
      ? (formData.get("newWhatsAppAccessToken") as string | null) || undefined
      : undefined,
    whatsappReturnTemplate: formData.get("whatsappReturnTemplate"),
    autoReturnEnabled: autoAllowed && formData.get("autoReturnEnabled") === "on",
    returnMessageDays: formData.get("returnMessageDays") || 20,
  });

  const existing = await prisma.tenantSettings.findUnique({ where: { tenantId } });

  const whatsappAccessToken = autoAllowed
    ? prepareCredentialForStorage(
        parsed.newWhatsAppAccessToken,
        existing?.whatsappAccessToken
      )
    : existing?.whatsappAccessToken ?? null;

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      whatsappEnabled: parsed.whatsappEnabled ?? false,
      whatsappReturnTemplate: parsed.whatsappReturnTemplate,
      autoReturnEnabled: parsed.autoReturnEnabled ?? false,
      returnMessageDays: parsed.returnMessageDays,
      whatsappPhoneNumberId: parsed.whatsappPhoneNumberId ?? null,
      whatsappAccessToken,
    },
    update: {
      whatsappEnabled: parsed.whatsappEnabled ?? false,
      whatsappReturnTemplate: parsed.whatsappReturnTemplate,
      autoReturnEnabled: parsed.autoReturnEnabled ?? false,
      returnMessageDays: parsed.returnMessageDays,
      ...(parsed.whatsappPhoneNumberId
        ? { whatsappPhoneNumberId: parsed.whatsappPhoneNumberId }
        : {}),
      ...(autoAllowed ? { whatsappAccessToken } : {}),
    },
  });

  revalidatePath("/whatsapp");
  return { success: true };
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
  await assertAutoWhatsApp(tenantId);

  const result = await processBulkReturnForTenant(tenantId);
  revalidatePath("/whatsapp");
  revalidatePath("/dashboard");
  return result;
}

export async function sendSingleReturnMessage(clientId: string) {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);
  await assertAutoWhatsApp(tenantId);

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

export async function markManualReturnSent(clientId: string) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
  });
  if (!client) throw new Error("Cliente não encontrado");

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  const days =
    client.lastVisitAt != null
      ? daysSince(client.lastVisitAt)
      : (settings?.returnMessageDays ?? 20);

  const message = renderMessageTemplate(
    settings?.whatsappReturnTemplate ??
      "Fala {nome}! Já faz {dias} dias do seu último corte na {barbearia}. Bora marcar? ✂️",
    {
      nome: client.name.split(" ")[0],
      dias: days,
      barbearia: tenant?.name ?? "nossa barbearia",
    }
  );

  await prisma.whatsAppMessage.create({
    data: {
      tenantId,
      clientId: client.id,
      phone: client.phone,
      message,
      type: "RETURN",
      status: "SENT",
      sentAt: new Date(),
    },
  });

  await prisma.client.update({
    where: { id: client.id },
    data: { lastReturnMessageAt: new Date() },
  });

  revalidatePath("/whatsapp");
  revalidatePath("/dashboard");
  return { success: true };
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
