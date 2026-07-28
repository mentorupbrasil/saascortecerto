import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { addDays, subDays } from "date-fns";
import { Decimal } from "@prisma/client/runtime/library";
import type { User } from "@prisma/client";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/security/request-ip", () => ({
  getClientIp: vi.fn(async () => "203.0.113.50"),
}));

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for integration tests");
  }
  return url;
}

requireDatabaseUrl();

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import {
  AuthError,
  requireAuthenticatedUser,
  type AuthenticatedUser,
} from "@/lib/authz";
import {
  openCashSession,
  addCashMovement,
  getCashSessionSummary,
} from "@/lib/finance/cash";
import {
  createSale,
  addSaleItem,
  recordSalePaymentsAndClose,
  cancelSale,
  getTodayNetRevenue,
  type SalesContext,
} from "@/lib/finance/sales";
import { rescheduleAppointmentWithConflictGuard } from "@/lib/domain/appointment-create";
import { updateAppointmentStatusSecure } from "@/lib/domain/appointment-status";
import { createAppointmentWithConflictGuard } from "@/lib/domain/appointment-create";
import { createPublicBookingCheckout } from "@/lib/public-booking-actions";
import { RateLimitError } from "@/lib/security/rate-limit";
import { DELETE as deleteClientPhoto } from "@/app/api/upload/client-photo/route";
import {
  createTenant,
  createUser,
  createService,
  createClient,
  resetDatabase,
} from "../factories";

const mockGetServerSession = vi.mocked(getServerSession);

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

async function asAuth(user: User): Promise<AuthenticatedUser & { tenantId: string }> {
  mockSession(user);
  const auth = await requireAuthenticatedUser();
  if (!auth.tenantId) throw new Error("tenant required");
  return auth as AuthenticatedUser & { tenantId: string };
}

function futureWeekdaySlot(hour = 10, minute = 0, daysAhead = 14): Date {
  for (let offset = daysAhead; offset < daysAhead + 14; offset++) {
    const probe = addDays(new Date(), offset);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(probe);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    if (weekday === "Sat" || weekday === "Sun") continue;
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const day = parts.find((p) => p.type === "day")!.value;
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    return new Date(`${y}-${m}-${day}T${hh}:${mm}:00-03:00`);
  }
  throw new Error("no weekday slot");
}

describe("round1 final patch integrity", () => {
  beforeAll(async () => {
    await resetDatabase(prisma);
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("expected cash balance uses all movements, not only the latest 20", async () => {
    const tenant = await createTenant(prisma, { slug: "patch-cash-gt20" });
    const owner = await createUser(prisma, { tenantId: tenant.id, role: "OWNER" });
    const ctx = { user: await asAuth(owner) };
    const session = await openCashSession(ctx, { openingBalance: "100.00" });

    for (let i = 0; i < 25; i++) {
      await addCashMovement(ctx, session.id, {
        type: "SUPPLY",
        amount: "1.00",
        notes: `supply-${i}`,
        idempotencyKey: `patch-supply-${session.id}-${i}`,
      });
    }
    await addCashMovement(ctx, session.id, {
      type: "BLEED",
      amount: "5.00",
      notes: "bleed",
      idempotencyKey: `patch-bleed-${session.id}`,
    });

    const summary = await getCashSessionSummary(session.id, tenant.id);
    // opening 100 + 25 supply - 5 bleed = 120
    expect(summary.movementCount).toBe(26);
    expect(summary.supply.toString()).toBe("25");
    expect(summary.bleed.toString()).toBe("5");
    expect(summary.expectedBalance.toString()).toBe("120");
  });

  it("refund today of yesterday sale reduces today's net revenue", async () => {
    const tenant = await createTenant(prisma, { slug: "patch-net-rev" });
    const owner = await createUser(prisma, { tenantId: tenant.id, role: "OWNER" });
    const barber = await createUser(prisma, { tenantId: tenant.id, role: "BARBER" });
    const service = await createService(prisma, tenant.id, { price: "80.00" });
    const client = await createClient(prisma, tenant.id);
    const ctx: SalesContext = { user: await asAuth(owner) };

    await openCashSession(ctx, { openingBalance: "0" });
    const sale = await createSale(ctx, {
      clientId: client.id,
      defaultBarberId: barber.id,
    });
    await addSaleItem(ctx, sale.id, {
      kind: "SERVICE",
      serviceId: service.id,
      barberId: barber.id,
    });
    await recordSalePaymentsAndClose(ctx, sale.id, {
      payments: [{ method: "PIX", amount: "80.00" }],
      idempotencyKey: `patch-pay-${sale.id}`,
    });

    const yesterday = subDays(new Date(), 1);
    await prisma.salePayment.updateMany({
      where: { saleId: sale.id },
      data: { createdAt: yesterday },
    });
    await prisma.sale.update({
      where: { id: sale.id },
      data: { closedAt: yesterday, createdAt: yesterday },
    });

    await cancelSale(ctx, sale.id, { reason: "estorno hoje" });

    const net = await getTodayNetRevenue(tenant.id, "America/Sao_Paulo");
    expect(net.toString()).toBe("-80");
  });

  it("user with only finance:sell cannot refund a paid sale", async () => {
    const tenant = await createTenant(prisma, { slug: "patch-refund-perm" });
    const owner = await createUser(prisma, { tenantId: tenant.id, role: "OWNER" });
    const barber = await createUser(prisma, { tenantId: tenant.id, role: "BARBER" });
    const service = await createService(prisma, tenant.id, { price: "50.00" });
    const client = await createClient(prisma, tenant.id);
    const ownerCtx: SalesContext = { user: await asAuth(owner) };

    await openCashSession(ownerCtx, { openingBalance: "0" });
    const sale = await createSale(ownerCtx, {
      clientId: client.id,
      defaultBarberId: barber.id,
    });
    await addSaleItem(ownerCtx, sale.id, {
      kind: "SERVICE",
      serviceId: service.id,
      barberId: barber.id,
    });
    await recordSalePaymentsAndClose(ownerCtx, sale.id, {
      payments: [{ method: "PIX", amount: "50.00" }],
      idempotencyKey: `patch-sell-only-${sale.id}`,
    });

    const sellerCtx: SalesContext = { user: await asAuth(barber) };
    await expect(cancelSale(sellerCtx, sale.id)).rejects.toThrow(
      /Sem permissão para estornar/
    );
  });

  it("receptionist cannot be used as professional on reschedule", async () => {
    const tenant = await createTenant(prisma, { slug: "patch-resched-role" });
    const owner = await createUser(prisma, { tenantId: tenant.id, role: "OWNER" });
    const receptionist = await createUser(prisma, {
      tenantId: tenant.id,
      role: "RECEPTIONIST",
    });
    const barber = await createUser(prisma, { tenantId: tenant.id, role: "BARBER" });
    const service = await createService(prisma, tenant.id);
    const client = await createClient(prisma, tenant.id);
    const slot = futureWeekdaySlot(10);

    const apt = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: slot,
      duration: service.duration,
      price: service.price,
    });

    await expect(
      rescheduleAppointmentWithConflictGuard({
        tenantId: tenant.id,
        appointmentId: apt.id,
        scheduledAt: futureWeekdaySlot(11),
        barberId: receptionist.id,
        actorUserId: owner.id,
      })
    ).rejects.toThrow(/não pode atender/);
  });

  it("direct createPublicBookingCheckout respects rate limits", async () => {
    const tenant = await createTenant(prisma, {
      slug: `patch-checkout-rl-${Date.now().toString(36)}`,
    });
    await createService(prisma, tenant.id);
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: {
        publicBookingEnabled: true,
        bookingRequirePixPayment: false,
        openTime: "07:00",
        closeTime: "22:00",
        workingDays: "1,2,3,4,5,6",
      },
    });
    const service = await prisma.service.findFirstOrThrow({ where: { tenantId: tenant.id } });
    const phone = "11987654321";

    const makeFd = (n: number) => {
      const fd = new FormData();
      fd.set("clientName", `Cliente ${n}`);
      fd.set("clientPhone", phone);
      fd.set("serviceId", service.id);
      fd.set("scheduledAt", futureWeekdaySlot(10, 0, 14 + n).toISOString());
      return fd;
    };

    // Phone limit is 4/hour — 5th must fail.
    for (let i = 0; i < 4; i++) {
      await expect(
        createPublicBookingCheckout(tenant.slug, makeFd(i))
      ).resolves.toBeTruthy();
    }
    await expect(
      createPublicBookingCheckout(tenant.slug, makeFd(99))
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("user without clients:manage cannot delete client photo", async () => {
    const tenant = await createTenant(prisma, { slug: "patch-photo-del-barber" });
    const barber = await createUser(prisma, { tenantId: tenant.id, role: "BARBER" });
    const client = await createClient(prisma, tenant.id);
    await prisma.client.update({
      where: { id: client.id },
      data: { photoUrl: "data:image/jpeg;base64,aaa" },
    });
    mockSession(barber);

    const res = await deleteClientPhoto(
      new NextRequest("http://localhost/api/upload/client-photo", {
        method: "DELETE",
        body: JSON.stringify({ clientId: client.id }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(403);
    const reloaded = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(reloaded.photoUrl).toBeTruthy();
  });

  it("other tenant cannot delete client photo", async () => {
    const tenantA = await createTenant(prisma, { slug: "patch-photo-del-a" });
    const tenantB = await createTenant(prisma, { slug: "patch-photo-del-b" });
    const ownerA = await createUser(prisma, { tenantId: tenantA.id, role: "OWNER" });
    const clientB = await createClient(prisma, tenantB.id);
    await prisma.client.update({
      where: { id: clientB.id },
      data: { photoUrl: "data:image/jpeg;base64,bbb" },
    });
    mockSession(ownerA);

    const res = await deleteClientPhoto(
      new NextRequest("http://localhost/api/upload/client-photo", {
        method: "DELETE",
        body: JSON.stringify({ clientId: clientB.id }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(404);
    const reloaded = await prisma.client.findUniqueOrThrow({ where: { id: clientB.id } });
    expect(reloaded.photoUrl).toBeTruthy();
  });

  it("OWNER and MANAGER can cancel appointments", async () => {
    const tenant = await createTenant(prisma, { slug: "patch-cancel-roles" });
    const owner = await createUser(prisma, { tenantId: tenant.id, role: "OWNER" });
    const manager = await createUser(prisma, { tenantId: tenant.id, role: "MANAGER" });
    const barber = await createUser(prisma, { tenantId: tenant.id, role: "BARBER" });
    const service = await createService(prisma, tenant.id);
    const client = await createClient(prisma, tenant.id);

    const aptOwner = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: futureWeekdaySlot(10),
      duration: service.duration,
      price: service.price,
    });
    const aptManager = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: futureWeekdaySlot(11),
      duration: service.duration,
      price: service.price,
    });

    await expect(
      updateAppointmentStatusSecure(aptOwner.id, "CANCELLED", await asAuth(owner))
    ).resolves.toEqual({ success: true });
    await expect(
      updateAppointmentStatusSecure(aptManager.id, "CANCELLED", await asAuth(manager))
    ).resolves.toEqual({ success: true });

    const o = await prisma.appointment.findUniqueOrThrow({ where: { id: aptOwner.id } });
    const m = await prisma.appointment.findUniqueOrThrow({ where: { id: aptManager.id } });
    expect(o.status).toBe("CANCELLED");
    expect(m.status).toBe("CANCELLED");
  });
});
