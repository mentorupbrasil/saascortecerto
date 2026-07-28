import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createHmac } from "crypto";
import { addDays, addMinutes, setHours, setMinutes, startOfDay } from "date-fns";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const required =
      process.env.CI === "true" || process.env.REQUIRE_DATABASE === "true";
    throw new Error(
      required
        ? "DATABASE_URL is required when CI=true or REQUIRE_DATABASE=true"
        : "DATABASE_URL is required for integration tests (P0). Set DATABASE_URL=postgresql://user:pass@localhost:5432/db"
    );
  }
  return url;
}

requireDatabaseUrl();

import { prisma } from "@/lib/prisma";
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  buildMercadoPagoEventKey,
  verifyMercadoPagoSignature,
  WEBHOOK_LEASE_MS,
  hashWebhookPayload,
} from "@/lib/integrations/mercadopago-webhook";
import { finalizeBookingFromVerifiedPayment } from "@/lib/domain/booking-finalize";
import {
  createTenant,
  createService,
  createUser,
  resetDatabase,
} from "../factories";

const PROVIDER = "mercadopago";

function futureWeekdaySlot(hour = 10, minute = 0): Date {
  let d = addDays(new Date(), 14);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d = addDays(d, 1);
  }
  return setMinutes(setHours(startOfDay(d), hour), minute);
}

function eventKeyFromNotification(notificationId: string, type = "payment") {
  return buildMercadoPagoEventKey({
    notificationId,
    type,
    action: "payment.updated",
    paymentId: "pay-shared",
    payloadHash: "unused-when-notification-present",
  });
}

function eventKeyFromPaymentAction(
  paymentId: string,
  action: string,
  rawBody: string,
  type = "payment"
) {
  return buildMercadoPagoEventKey({
    notificationId: null,
    type,
    action,
    paymentId,
    payloadHash: hashWebhookPayload(rawBody),
  });
}

async function seedProcessingEvent(options: {
  eventKey: string;
  lockedAt: Date;
  attemptCount?: number;
}) {
  await prisma.processedWebhookEvent.create({
    data: {
      provider: PROVIDER,
      eventKey: options.eventKey,
      status: "PROCESSING",
      lockedAt: options.lockedAt,
      attemptCount: options.attemptCount ?? 1,
    },
  });
}

describe("Mercado Pago webhook idempotency (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("same notificationId twice → second claim is duplicate", async () => {
    const eventKey = eventKeyFromNotification("notif-dup-001");

    expect(await claimWebhookEvent({ provider: PROVIDER, eventKey })).toBe(
      "claimed"
    );
    expect(await claimWebhookEvent({ provider: PROVIDER, eventKey })).toBe(
      "duplicate"
    );
  });

  it("two different notificationIds with same paymentId+action → both claimed (different event keys)", async () => {
    const paymentId = "pay-1001";
    const rawBody = JSON.stringify({
      type: "payment",
      action: "payment.updated",
      data: { id: paymentId },
    });
    const keyA = buildMercadoPagoEventKey({
      notificationId: "notif-a",
      type: "payment",
      action: "payment.updated",
      paymentId,
      payloadHash: hashWebhookPayload(rawBody),
    });
    const keyB = buildMercadoPagoEventKey({
      notificationId: "notif-b",
      type: "payment",
      action: "payment.updated",
      paymentId,
      payloadHash: hashWebhookPayload(rawBody),
    });

    expect(keyA).not.toBe(keyB);
    expect(await claimWebhookEvent({ provider: PROVIDER, eventKey: keyA })).toBe(
      "claimed"
    );
    expect(await claimWebhookEvent({ provider: PROVIDER, eventKey: keyB })).toBe(
      "claimed"
    );
  });

  it("pending then approved notifications for same payment → both claimable (distinct event keys; payment processor is separate)", async () => {
    const paymentId = "pay-lifecycle-42";
    const pendingBody = JSON.stringify({
      type: "payment",
      action: "payment.created",
      data: { id: paymentId },
    });
    const approvedBody = JSON.stringify({
      type: "payment",
      action: "payment.updated",
      data: { id: paymentId },
    });

    const pendingKey = eventKeyFromPaymentAction(
      paymentId,
      "payment.created",
      pendingBody
    );
    const approvedKey = eventKeyFromPaymentAction(
      paymentId,
      "payment.updated",
      approvedBody
    );

    expect(pendingKey).not.toBe(approvedKey);
    expect(
      await claimWebhookEvent({ provider: PROVIDER, eventKey: pendingKey })
    ).toBe("claimed");
    expect(
      await claimWebhookEvent({ provider: PROVIDER, eventKey: approvedKey })
    ).toBe("claimed");

    // Each webhook event is idempotent by notification/action key — not by payment id alone.
    const rows = await prisma.processedWebhookEvent.findMany({
      where: { provider: PROVIDER, eventKey: { in: [pendingKey, approvedKey] } },
    });
    expect(rows).toHaveLength(2);
  });

  it("PROCESSING with lockedAt=now → claim returns duplicate", async () => {
    const eventKey = eventKeyFromNotification("notif-active-lock");
    const now = new Date();

    expect(
      await claimWebhookEvent({ provider: PROVIDER, eventKey, now })
    ).toBe("claimed");
    expect(
      await claimWebhookEvent({ provider: PROVIDER, eventKey, now })
    ).toBe("duplicate");
  });

  it("PROCESSING with expired lease → reclaim (claimed) and attemptCount increments", async () => {
    const eventKey = eventKeyFromNotification("notif-expired-lease");
    const now = new Date();
    const expiredLockedAt = new Date(now.getTime() - WEBHOOK_LEASE_MS - 5_000);

    await seedProcessingEvent({
      eventKey,
      lockedAt: expiredLockedAt,
      attemptCount: 2,
    });

    expect(
      await claimWebhookEvent({ provider: PROVIDER, eventKey, now })
    ).toBe("claimed");

    const row = await prisma.processedWebhookEvent.findFirst({
      where: { provider: PROVIDER, eventKey },
    });
    expect(row?.status).toBe("PROCESSING");
    expect(row?.attemptCount).toBe(3);
  });

  it("FAILED → reclaim returns claimed", async () => {
    const eventKey = eventKeyFromNotification("notif-failed-reclaim");

    expect(await claimWebhookEvent({ provider: PROVIDER, eventKey })).toBe(
      "claimed"
    );
    await failWebhookEvent(PROVIDER, eventKey, new Error("simulated failure"));

    const failed = await prisma.processedWebhookEvent.findFirst({
      where: { provider: PROVIDER, eventKey },
    });
    expect(failed?.status).toBe("FAILED");

    expect(await claimWebhookEvent({ provider: PROVIDER, eventKey })).toBe(
      "claimed"
    );
  });

  it("parallel claimWebhookEvent on expired PROCESSING → exactly one claimed", async () => {
    const eventKey = eventKeyFromNotification("notif-race");
    const now = new Date();
    const expiredLockedAt = new Date(now.getTime() - WEBHOOK_LEASE_MS - 1_000);

    await seedProcessingEvent({ eventKey, lockedAt: expiredLockedAt });

    const results = await Promise.all([
      claimWebhookEvent({ provider: PROVIDER, eventKey, now }),
      claimWebhookEvent({ provider: PROVIDER, eventKey, now }),
    ]);

    const claimed = results.filter((r) => r === "claimed");
    const duplicate = results.filter((r) => r === "duplicate");

    expect(claimed).toHaveLength(1);
    expect(duplicate).toHaveLength(1);
  });

  it("signature uses query data.id — verifyMercadoPagoSignature succeeds with matching id and fails with wrong id", () => {
    const QUERY_ID = "987654321";
    const secret = "test-webhook-secret";
    const ts = "1700000000";
    const xRequestId = "req-query-id-test";
    const manifest = `id:${QUERY_ID};request-id:${xRequestId};ts:${ts};`;
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");

    const ok = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId,
      dataId: QUERY_ID,
      secret,
    });
    expect(ok.ok).toBe(true);

    const bad = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId,
      dataId: "000000000",
      secret,
    });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe("signature_mismatch");
  });

  it("PublicBookingCheckout claim + finalizeBookingFromVerifiedPayment creates one appointment", async () => {
    const tenant = await createTenant(prisma, { slug: "shop-webhook-finalize" });
    const service = await createService(prisma, tenant.id);
    const barber = await createUser(prisma, {
      tenantId: tenant.id,
      role: "BARBER",
    });
    const scheduledAt = futureWeekdaySlot(15);
    const paymentId = "mp-pay-finalize-001";

    const checkout = await prisma.publicBookingCheckout.create({
      data: {
        tenantId: tenant.id,
        clientName: "Cliente Webhook",
        clientPhone: "11944443333",
        serviceId: service.id,
        barberId: barber.id,
        scheduledAt,
        amount: service.price,
        expiresAt: addMinutes(new Date(), 30),
        serviceName: service.name,
        serviceDuration: service.duration,
        servicePrice: service.price,
        status: "PENDING_PAYMENT",
      },
    });

    const eventKey = eventKeyFromNotification(`notif-${paymentId}`);
    expect(await claimWebhookEvent({ provider: PROVIDER, eventKey })).toBe(
      "claimed"
    );

    await prisma.publicBookingCheckout.update({
      where: { id: checkout.id },
      data: {
        status: "PAID",
        mercadoPagoPaymentId: paymentId,
        paidAt: new Date(),
      },
    });

    const finalized = await finalizeBookingFromVerifiedPayment(checkout.id, {
      paymentSource: "TEST",
    });

    expect(finalized.appointment.tenantId).toBe(tenant.id);
    expect(
      await prisma.appointment.count({ where: { tenantId: tenant.id } })
    ).toBe(1);

    await completeWebhookEvent(PROVIDER, eventKey, "ok");
  });

  it("duplicate webhook claim prevents a second finalize path for the same notification", async () => {
    const tenant = await createTenant(prisma, { slug: "shop-webhook-dup-finalize" });
    const service = await createService(prisma, tenant.id);
    const scheduledAt = futureWeekdaySlot(16);
    const notificationId = "notif-single-finalize";

    const checkout = await prisma.publicBookingCheckout.create({
      data: {
        tenantId: tenant.id,
        clientName: "Cliente Dup",
        clientPhone: "11933332222",
        serviceId: service.id,
        scheduledAt,
        amount: service.price,
        expiresAt: addMinutes(new Date(), 30),
        serviceName: service.name,
        serviceDuration: service.duration,
        servicePrice: service.price,
        status: "PAID",
        paidAt: new Date(),
        mercadoPagoPaymentId: "mp-pay-dup-finalize",
      },
    });

    const eventKey = eventKeyFromNotification(notificationId);

    expect(await claimWebhookEvent({ provider: PROVIDER, eventKey })).toBe(
      "claimed"
    );
    await finalizeBookingFromVerifiedPayment(checkout.id, {
      paymentSource: "TEST",
    });
    await completeWebhookEvent(PROVIDER, eventKey, "ok");

    expect(await claimWebhookEvent({ provider: PROVIDER, eventKey })).toBe(
      "duplicate"
    );

    expect(
      await prisma.appointment.count({ where: { tenantId: tenant.id } })
    ).toBe(1);
  });

  it("SignupCheckout rejects duplicate mercadoPagoPaymentId on second insert", async () => {
    const paymentId = "mp-signup-unique-999";
    const passwordHash = await bcrypt.hash("password123", 4);

    const base = {
      plan: "PRO" as const,
      amount: new Decimal("99.00"),
      barbershopName: "Barbearia Nova",
      ownerName: "Owner",
      passwordHash,
      status: "PENDING" as const,
    };

    await prisma.signupCheckout.create({
      data: {
        ...base,
        slug: "barbearia-a",
        ownerEmail: "owner-a@test.local",
        mercadoPagoPaymentId: paymentId,
      },
    });

    await expect(
      prisma.signupCheckout.create({
        data: {
          ...base,
          slug: "barbearia-b",
          ownerEmail: "owner-b@test.local",
          mercadoPagoPaymentId: paymentId,
        },
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
    );
  });
});
