import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { addDays, addMinutes, setHours, setMinutes, startOfDay } from "date-fns";
import { Decimal } from "@prisma/client/runtime/library";
import type { User } from "@prisma/client";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import {
  AuthError,
  requireAuthenticatedUser,
  requireTenantAdmin,
  requireTenantUser,
  type AuthenticatedUser,
} from "@/lib/authz";
import {
  createAppointmentAtomic,
  createAppointmentWithConflictGuard,
} from "@/lib/domain/appointment-create";
import { finalizeBookingFromVerifiedPayment } from "@/lib/domain/booking-finalize";
import { updateAppointmentStatusSecure } from "@/lib/domain/appointment-status";
import {
  claimWebhookEvent,
  failWebhookEvent,
} from "@/lib/integrations/mercadopago-webhook";
import { closeSale } from "@/lib/finance/sales";
import { getAgendaOnlineItems } from "@/lib/public-booking-actions";
import {
  createClient,
  createService,
  createTenant,
  createUser,
  resetDatabase,
} from "../factories";

const mockGetServerSession = vi.mocked(getServerSession);

function futureWeekdaySlot(hour = 10, minute = 0): Date {
  let d = addDays(new Date(), 14);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d = addDays(d, 1);
  }
  return setMinutes(setHours(startOfDay(d), hour), minute);
}

function mockSession(user: Pick<User, "id" | "email" | "name" | "role" | "tenantId">) {
  mockGetServerSession.mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as never);
}

async function asAuthenticatedUser(
  user: User
): Promise<AuthenticatedUser & { tenantId: string }> {
  mockSession(user);
  const authUser = await requireAuthenticatedUser();
  if (!authUser.tenantId) {
    throw new Error("Expected tenant-bound user for sales context");
  }
  return authUser as AuthenticatedUser & { tenantId: string };
}

describe("cross-tenant isolation & concurrency (PostgreSQL)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("tenant A cannot read tenant B appointment by id with A tenantId filter", async () => {
    const tenantA = await createTenant(prisma, { slug: "shop-a" });
    const tenantB = await createTenant(prisma, { slug: "shop-b" });
    const serviceB = await createService(prisma, tenantB.id);
    const clientB = await createClient(prisma, tenantB.id);
    const barberB = await createUser(prisma, {
      tenantId: tenantB.id,
      role: "BARBER",
    });
    const scheduledAt = futureWeekdaySlot(11);

    const appointmentB = await prisma.appointment.create({
      data: {
        tenantId: tenantB.id,
        clientId: clientB.id,
        serviceId: serviceB.id,
        barberId: barberB.id,
        scheduledAt,
        duration: 30,
        price: new Decimal("50.00"),
        status: "SCHEDULED",
      },
    });

    const crossRead = await prisma.appointment.findFirst({
      where: { id: appointmentB.id, tenantId: tenantA.id },
    });

    expect(crossRead).toBeNull();
  });

  it("tenant A cannot update tenant B client (updateMany count 0)", async () => {
    const tenantA = await createTenant(prisma, { slug: "shop-a-upd" });
    const tenantB = await createTenant(prisma, { slug: "shop-b-upd" });
    const clientB = await createClient(prisma, tenantB.id, { name: "Original B" });

    const result = await prisma.client.updateMany({
      where: { id: clientB.id, tenantId: tenantA.id },
      data: { name: "Hacked from A" },
    });

    expect(result.count).toBe(0);

    const unchanged = await prisma.client.findUniqueOrThrow({
      where: { id: clientB.id },
    });
    expect(unchanged.name).toBe("Original B");
  });

  it("public booking checkout for tenant A cannot finalize into tenant B", async () => {
    const tenantA = await createTenant(prisma, { slug: "shop-a-book" });
    const tenantB = await createTenant(prisma, { slug: "shop-b-book" });
    const serviceA = await createService(prisma, tenantA.id);
    const serviceB = await createService(prisma, tenantB.id);
    const barberA = await createUser(prisma, {
      tenantId: tenantA.id,
      role: "BARBER",
    });
    const clientB = await createClient(prisma, tenantB.id);
    const scheduledAt = futureWeekdaySlot(10);

    const checkoutA = await prisma.publicBookingCheckout.create({
      data: {
        tenantId: tenantA.id,
        clientName: "Cliente A",
        clientPhone: "11988887777",
        serviceId: serviceA.id,
        barberId: barberA.id,
        scheduledAt,
        amount: serviceA.price,
        expiresAt: addMinutes(new Date(), 30),
        serviceName: serviceA.name,
        serviceDuration: serviceA.duration,
        servicePrice: serviceA.price,
        status: "PENDING_PAYMENT",
      },
    });

    await expect(
      createAppointmentAtomic({
        tenantId: tenantB.id,
        clientId: clientB.id,
        serviceId: serviceB.id,
        barberId: null,
        scheduledAt,
        duration: serviceA.duration,
        price: serviceA.price,
        checkoutId: checkoutA.id,
        status: "CONFIRMED",
        bookedOnline: true,
        origin: "PUBLIC",
      })
    ).rejects.toThrow("Checkout não pertence a esta barbearia");

    expect(
      await prisma.appointment.count({ where: { tenantId: tenantB.id } })
    ).toBe(0);

    const finalized = await finalizeBookingFromVerifiedPayment(checkoutA.id, {
      paymentSource: "TEST",
    });

    expect(finalized.appointment.tenantId).toBe(tenantA.id);
    expect(
      await prisma.appointment.count({ where: { tenantId: tenantB.id } })
    ).toBe(0);
    expect(
      await prisma.appointment.count({ where: { tenantId: tenantA.id } })
    ).toBe(1);
  });

  it("getAgendaOnlineItems returns only session tenant pending checkouts", async () => {
    const tenantA = await createTenant(prisma, { slug: "shop-a-agenda" });
    const tenantB = await createTenant(prisma, { slug: "shop-b-agenda" });
    const ownerA = await createUser(prisma, {
      tenantId: tenantA.id,
      role: "OWNER",
    });
    const serviceA = await createService(prisma, tenantA.id);
    const serviceB = await createService(prisma, tenantB.id);
    const scheduledAt = futureWeekdaySlot(14);

    const checkoutA = await prisma.publicBookingCheckout.create({
      data: {
        tenantId: tenantA.id,
        clientName: "Cliente A",
        clientPhone: "11977776666",
        serviceId: serviceA.id,
        scheduledAt,
        amount: serviceA.price,
        expiresAt: addMinutes(new Date(), 30),
        serviceName: serviceA.name,
        serviceDuration: serviceA.duration,
        servicePrice: serviceA.price,
        status: "PENDING_PAYMENT",
      },
    });

    await prisma.publicBookingCheckout.create({
      data: {
        tenantId: tenantB.id,
        clientName: "Cliente B",
        clientPhone: "11966665555",
        serviceId: serviceB.id,
        scheduledAt,
        amount: serviceB.price,
        expiresAt: addMinutes(new Date(), 30),
        serviceName: serviceB.name,
        serviceDuration: serviceB.duration,
        servicePrice: serviceB.price,
        status: "PENDING_PAYMENT",
      },
    });

    mockSession(ownerA);
    const agenda = await getAgendaOnlineItems();

    expect(agenda.pendingCheckouts.map((c) => c.id)).toContain(checkoutA.id);
    expect(agenda.pendingCheckouts).toHaveLength(1);
    expect(agenda.pendingCheckouts[0]?.clientName).toBe("Cliente A");
  });

  it("barber cannot update another barber appointment status", async () => {
    const tenant = await createTenant(prisma, { slug: "shop-barber-scope" });
    const barberA = await createUser(prisma, {
      tenantId: tenant.id,
      role: "BARBER",
      name: "Barber A",
    });
    const barberB = await createUser(prisma, {
      tenantId: tenant.id,
      role: "BARBER",
      name: "Barber B",
    });
    const service = await createService(prisma, tenant.id);
    const client = await createClient(prisma, tenant.id);
    const scheduledAt = futureWeekdaySlot(11);

    const appointmentB = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        serviceId: service.id,
        barberId: barberB.id,
        scheduledAt,
        duration: 30,
        price: service.price,
        status: "SCHEDULED",
      },
    });

    const actorA = await asAuthenticatedUser(barberA);

    await expect(
      updateAppointmentStatusSecure(appointmentB.id, "CONFIRMED", actorA)
    ).rejects.toThrow("Agendamento não encontrado");

    const directUpdate = await prisma.appointment.updateMany({
      where: {
        id: appointmentB.id,
        tenantId: tenant.id,
        barberId: barberA.id,
      },
      data: { status: "CONFIRMED" },
    });
    expect(directUpdate.count).toBe(0);
  });

  it("SUPER_ADMIN without tenantId cannot use requireTenantUser", async () => {
    const admin = await createUser(prisma, {
      tenantId: null,
      role: "SUPER_ADMIN",
    });

    mockSession(admin);

    await expect(requireTenantUser()).rejects.toBeInstanceOf(AuthError);
    await expect(requireTenantUser()).rejects.toMatchObject({
      code: "TENANT_REQUIRED",
    });
  });

  it("deactivated user fails requireAuthenticatedUser with INACTIVE", async () => {
    const tenant = await createTenant(prisma, { slug: "shop-inactive" });
    const user = await createUser(prisma, {
      tenantId: tenant.id,
      role: "OWNER",
      active: false,
    });

    mockSession(user);

    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(AuthError);
    await expect(requireAuthenticatedUser()).rejects.toMatchObject({
      code: "INACTIVE",
    });
  });

  it("requireTenantAdmin uses DB role when session claims OWNER but DB is BARBER", async () => {
    const tenant = await createTenant(prisma, { slug: "shop-role-drift" });
    const user = await createUser(prisma, {
      tenantId: tenant.id,
      role: "BARBER",
    });

    mockGetServerSession.mockResolvedValue({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: "OWNER",
        tenantId: tenant.id,
      },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    } as never);

    await expect(requireTenantAdmin()).rejects.toBeInstanceOf(AuthError);
    await expect(requireTenantAdmin()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("concurrent createAppointmentWithConflictGuard allows exactly one booking", async () => {
    const tenant = await createTenant(prisma, { slug: "shop-conflict" });
    const barber = await createUser(prisma, {
      tenantId: tenant.id,
      role: "BARBER",
    });
    const service = await createService(prisma, tenant.id);
    const client1 = await createClient(prisma, tenant.id, { phone: "11911111111" });
    const client2 = await createClient(prisma, tenant.id, { phone: "11922222222" });
    const scheduledAt = futureWeekdaySlot(10);

    const baseInput = {
      tenantId: tenant.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt,
      duration: 30,
      price: service.price,
    };

    const results = await Promise.allSettled([
      createAppointmentWithConflictGuard({
        ...baseInput,
        clientId: client1.id,
      }),
      createAppointmentWithConflictGuard({
        ...baseInput,
        clientId: client2.id,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const count = await prisma.appointment.count({
      where: { tenantId: tenant.id, barberId: barber.id, scheduledAt },
    });
    expect(count).toBe(1);
  });

  it("paid checkout finalize is idempotent (one appointment after two finalize calls)", async () => {
    const tenant = await createTenant(prisma, { slug: "shop-idempotent" });
    const service = await createService(prisma, tenant.id);
    const barber = await createUser(prisma, {
      tenantId: tenant.id,
      role: "BARBER",
    });
    const scheduledAt = futureWeekdaySlot(15);

    const checkout = await prisma.publicBookingCheckout.create({
      data: {
        tenantId: tenant.id,
        clientName: "Cliente Idempotent",
        clientPhone: "11955554444",
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

    const first = await finalizeBookingFromVerifiedPayment(checkout.id, {
      paymentSource: "TEST",
    });
    const second = await finalizeBookingFromVerifiedPayment(checkout.id, {
      paymentSource: "TEST",
    });

    expect(first.appointment.id).toBe(second.appointment.id);
    expect(
      await prisma.appointment.count({ where: { tenantId: tenant.id } })
    ).toBe(1);
  });

  it("claimWebhookEvent duplicate detection and reclaim after fail", async () => {
    const provider = "mercadopago";
    const eventKey = `test-event-${Date.now()}`;

    expect(await claimWebhookEvent({ provider, eventKey })).toBe("claimed");
    expect(await claimWebhookEvent({ provider, eventKey })).toBe("duplicate");

    await failWebhookEvent(provider, eventKey, "simulated failure");
    expect(await claimWebhookEvent({ provider, eventKey })).toBe("claimed");
  });

  it("concurrent closeSale creates one commission entry and one cash movement", async () => {
    const tenant = await createTenant(prisma, { slug: "shop-sale-close" });
    const owner = await createUser(prisma, {
      tenantId: tenant.id,
      role: "OWNER",
    });
    const barber = await createUser(prisma, {
      tenantId: tenant.id,
      role: "BARBER",
    });
    const service = await createService(prisma, tenant.id, { price: "80.00" });
    const ctx = { user: await asAuthenticatedUser(owner) };

    await prisma.commissionRule.create({
      data: {
        tenantId: tenant.id,
        name: "Barber service 10%",
        type: "PERCENTAGE",
        rate: new Decimal("10"),
        barberId: barber.id,
        serviceId: service.id,
        active: true,
      },
    });

    const location = await prisma.location.create({
      data: {
        tenantId: tenant.id,
        name: "Principal",
        slug: "principal",
        isPrimary: true,
        active: true,
      },
    });

    const cashSession = await prisma.cashSession.create({
      data: {
        tenantId: tenant.id,
        locationId: location.id,
        operatorUserId: owner.id,
        status: "OPEN",
        openingBalance: new Decimal("0"),
      },
    });

    const sale = await prisma.sale.create({
      data: {
        tenantId: tenant.id,
        status: "OPEN",
        operatorUserId: owner.id,
        locationId: location.id,
        cashSessionId: cashSession.id,
        subtotal: new Decimal("80"),
        total: new Decimal("80"),
      },
    });

    const saleItem = await prisma.saleItem.create({
      data: {
        tenantId: tenant.id,
        saleId: sale.id,
        kind: "SERVICE",
        serviceId: service.id,
        barberId: barber.id,
        name: service.name,
        quantity: 1,
        unitPrice: new Decimal("80"),
        discount: new Decimal("0"),
        total: new Decimal("80"),
      },
    });

    await prisma.salePayment.create({
      data: {
        tenantId: tenant.id,
        saleId: sale.id,
        method: "CASH",
        amount: new Decimal("80"),
        status: "COMPLETED",
        source: "PAID_MANUAL",
      },
    });

    await Promise.all([closeSale(ctx, sale.id), closeSale(ctx, sale.id)]);

    const closedSale = await prisma.sale.findUniqueOrThrow({
      where: { id: sale.id },
    });
    expect(closedSale.status).toBe("CLOSED");

    expect(
      await prisma.commissionEntry.count({
        where: { tenantId: tenant.id, saleItemId: saleItem.id },
      })
    ).toBe(1);

    expect(
      await prisma.cashMovement.count({
        where: { idempotencyKey: `sale-close:${sale.id}` },
      })
    ).toBe(1);
  });
});
