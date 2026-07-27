import "server-only";

import { prisma } from "@/lib/prisma";
import {
  markDomainEventStatus,
  parseDomainEventPayload,
  type DomainEventPayload,
} from "@/lib/automation/events";
import { renderMessageTemplate } from "@/lib/whatsapp";

const BATCH_SIZE = 50;

type AutomationAction = {
  type: "whatsapp";
  template: string;
  recipientField?: string;
};

type AutomationConditions = {
  field?: string;
  equals?: string | number | boolean;
};

function parseJsonField<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function matchesConditions(
  payload: DomainEventPayload,
  conditions: AutomationConditions | AutomationConditions[] | null
): boolean {
  if (!conditions) return true;
  const list = Array.isArray(conditions) ? conditions : [conditions];
  if (list.length === 0) return true;

  return list.every((cond) => {
    if (!cond.field) return true;
    const value = payload[cond.field];
    if (cond.equals === undefined) return value !== undefined && value !== null;
    return String(value) === String(cond.equals);
  });
}

function resolveRecipient(
  payload: DomainEventPayload,
  action: AutomationAction
): string | null {
  const field = action.recipientField ?? "phone";
  const raw = payload[field];
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.replace(/\D/g, "");
}

function buildOutboxMetadata(
  eventId: string,
  ruleId: string,
  payload: DomainEventPayload
) {
  return JSON.stringify({
    domainEventId: eventId,
    automationRuleId: ruleId,
    idempotencyKey: `${eventId}:${ruleId}`,
    clientId: typeof payload.clientId === "string" ? payload.clientId : null,
  });
}

async function enqueueWhatsAppAction(
  tenantId: string,
  eventId: string,
  ruleId: string,
  action: AutomationAction,
  payload: DomainEventPayload
) {
  const recipient = resolveRecipient(payload, action);
  if (!recipient) return { skipped: true, reason: "missing_recipient" };

  const idempotencyKey = `${eventId}:${ruleId}`;
  const existing = await prisma.messageOutbox.findFirst({
    where: {
      tenantId,
      metadata: { contains: idempotencyKey },
      status: { in: ["PENDING", "SENT"] },
    },
  });
  if (existing) return { skipped: true, reason: "duplicate" };

  const stringVars: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      stringVars[key] = typeof value === "boolean" ? (value ? "sim" : "não") : value;
    }
  }

  const message = renderMessageTemplate(action.template, stringVars);

  await prisma.messageOutbox.create({
    data: {
      tenantId,
      channel: "WHATSAPP",
      recipient,
      message,
      status: "PENDING",
      metadata: buildOutboxMetadata(eventId, ruleId, payload),
    },
  });

  return { enqueued: true };
}

export async function processPendingDomainEvents(options?: { tenantId?: string }) {
  const events = await prisma.domainEvent.findMany({
    where: {
      status: "PENDING",
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  let processed = 0;
  let failed = 0;
  let enqueued = 0;

  for (const event of events) {
    try {
      const payload = parseDomainEventPayload(event.payload);
      const rules = await prisma.automationRule.findMany({
        where: {
          tenantId: event.tenantId,
          active: true,
          trigger: event.eventType,
        },
      });

      for (const rule of rules) {
        const conditions = parseJsonField<AutomationConditions | AutomationConditions[] | null>(
          rule.conditions,
          null
        );
        if (!matchesConditions(payload, conditions)) continue;

        const actions = parseJsonField<AutomationAction[]>(rule.actions, []);
        for (const action of actions) {
          if (action.type !== "whatsapp" || !action.template) continue;
          const result = await enqueueWhatsAppAction(
            event.tenantId,
            event.id,
            rule.id,
            action,
            payload
          );
          if (result.enqueued) enqueued++;
        }
      }

      await markDomainEventStatus(event.id, "PROCESSED");
      processed++;
    } catch (err) {
      failed++;
      await markDomainEventStatus(event.id, "FAILED");
      console.error("[automation/dispatcher] event failed", event.id, err);
    }
  }

  return { scanned: events.length, processed, failed, enqueued };
}
