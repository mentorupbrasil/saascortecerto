import "server-only";

import { prisma } from "@/lib/prisma";
import { isWhatsAppDemoMode } from "@/lib/env";
import { sendWhatsAppText } from "@/lib/whatsapp";
import type { MessageOutboxStatus } from "@prisma/client";

const BATCH_SIZE = 30;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 60_000;

type OutboxMetadata = {
  domainEventId?: string;
  automationRuleId?: string;
  idempotencyKey?: string;
  clientId?: string | null;
  retryCount?: number;
  lastAttemptAt?: string;
};

function parseMetadata(raw: string | null | undefined): OutboxMetadata {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as OutboxMetadata;
  } catch {
    return {};
  }
}

async function hasWhatsAppConsent(
  tenantId: string,
  clientId: string | null | undefined,
  phone: string
): Promise<boolean> {
  if (clientId) {
    const consent = await prisma.clientConsent.findUnique({
      where: { clientId_type: { clientId, type: "WHATSAPP" } },
    });
    if (consent) {
      return consent.granted && !consent.revokedAt;
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: { whatsappOptIn: true },
    });
    return client?.whatsappOptIn ?? false;
  }

  const client = await prisma.client.findFirst({
    where: { tenantId, phone: phone.replace(/\D/g, "") },
    select: { id: true, whatsappOptIn: true },
  });
  if (!client) return true;

  const consent = await prisma.clientConsent.findUnique({
    where: { clientId_type: { clientId: client.id, type: "WHATSAPP" } },
  });
  if (consent) return consent.granted && !consent.revokedAt;
  return client.whatsappOptIn;
}

function shouldRetry(metadata: OutboxMetadata): boolean {
  const count = metadata.retryCount ?? 0;
  if (count >= MAX_RETRIES) return false;
  if (!metadata.lastAttemptAt) return true;
  const elapsed = Date.now() - new Date(metadata.lastAttemptAt).getTime();
  const backoff = RETRY_BASE_MS * Math.pow(2, count);
  return elapsed >= backoff;
}

export async function processMessageOutbox(options?: { tenantId?: string }) {
  const now = new Date();
  const messages = await prisma.messageOutbox.findMany({
    where: {
      status: "PENDING",
      channel: "WHATSAPP",
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let cancelled = 0;

  for (const msg of messages) {
    const metadata = parseMetadata(msg.metadata);

    if (!shouldRetry(metadata)) {
      await prisma.messageOutbox.update({
        where: { id: msg.id },
        data: {
          status: "FAILED",
          error: "Máximo de tentativas excedido",
        },
      });
      failed++;
      continue;
    }

    const consentOk = await hasWhatsAppConsent(
      msg.tenantId,
      metadata.clientId,
      msg.recipient
    );
    if (!consentOk) {
      await prisma.messageOutbox.update({
        where: { id: msg.id },
        data: {
          status: "CANCELLED",
          error: "Cliente sem consentimento WhatsApp (LGPD)",
        },
      });
      cancelled++;
      continue;
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: msg.tenantId },
    });
    if (!settings) {
      await prisma.messageOutbox.update({
        where: { id: msg.id },
        data: { status: "FAILED", error: "Configurações não encontradas" },
      });
      failed++;
      continue;
    }

    const demoMode = isWhatsAppDemoMode();
    const result = await sendWhatsAppText(settings, msg.recipient, msg.message);

    const nextMetadata: OutboxMetadata = {
      ...metadata,
      retryCount: (metadata.retryCount ?? 0) + 1,
      lastAttemptAt: new Date().toISOString(),
    };

    let status: MessageOutboxStatus = "PENDING";
    let error: string | null = null;
    let sentAt: Date | null = null;

    if (result.success && (result.messageId || demoMode)) {
      status = "SENT";
      sentAt = new Date();
      sent++;
    } else if (result.success && !result.messageId && !demoMode) {
      error = "Meta não retornou messageId — não marcado como enviado";
      if ((nextMetadata.retryCount ?? 0) >= MAX_RETRIES) {
        status = "FAILED";
        failed++;
      }
    } else {
      error = result.error ?? "Falha no envio";
      if ((nextMetadata.retryCount ?? 0) >= MAX_RETRIES) {
        status = "FAILED";
        failed++;
      }
    }

    if (status === "PENDING" && error) {
      skipped++;
    }

    await prisma.messageOutbox.update({
      where: { id: msg.id },
      data: {
        status,
        error,
        sentAt,
        metadata: JSON.stringify(nextMetadata),
      },
    });

    await new Promise((r) => setTimeout(r, 300));
  }

  return { scanned: messages.length, sent, failed, skipped, cancelled };
}

export async function runAutomationPipeline(options?: { tenantId?: string }) {
  const { processPendingDomainEvents } = await import("@/lib/automation/dispatcher");
  const dispatch = await processPendingDomainEvents(options);
  const outbox = await processMessageOutbox(options);
  return { dispatch, outbox };
}
