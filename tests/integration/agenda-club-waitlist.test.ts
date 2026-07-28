import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { addDays, addMinutes } from "date-fns";
import { createHash } from "crypto";
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
import { AuthError, requireAuthenticatedUser, type AuthenticatedUser } from "@/lib/authz";
import {
  createAppointmentWithConflictGuard,
  rescheduleAppointmentWithConflictGuard,
} from "@/lib/domain/appointment-create";
import { updateAppointmentStatusSecure } from "@/lib/domain/appointment-status";
import { joinWaitlist, offerSlot, confirmWaitlistOffer } from "@/lib/domain/waitlist";
import {
  createTenant,
  createUser,
  createService,
  createClient,
  createMembershipPlan,
  createMembership,
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

async function asAuthenticatedUser(
  user: User
): Promise<AuthenticatedUser & { tenantId: string }> {
  mockSession(user);
  const authUser = await requireAuthenticatedUser();
  if (!authUser.tenantId) {
    throw new Error("Expected tenant-bound user");
  }
  return authUser as AuthenticatedUser & { tenantId: string };
}

/** Wall-clock slot in America/Sao_Paulo (tenant factory default), CI-safe (UTC runners). */
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
    // Brazil currently observes UTC-3 year-round (no DST).
    return new Date(`${y}-${m}-${day}T${hh}:${mm}:00-03:00`);
  }
  throw new Error("Não foi possível encontrar um dia útil para o slot de teste");
}

async function setupTenant(slug: string) {
  const tenant = await createTenant(prisma, { slug });
  const owner = await createUser(prisma, { tenantId: tenant.id, role: "OWNER" });
  const receptionist = await createUser(prisma, { tenantId: tenant.id, role: "RECEPTIONIST" });
  const barber = await createUser(prisma, { tenantId: tenant.id, role: "BARBER" });
  const service = await createService(prisma, tenant.id, { price: "50.00", duration: 30 });
  const client = await createClient(prisma, tenant.id);
  return { tenant, owner, receptionist, barber, service, client };
}

describe("agenda, club membership & waitlist integrity (PostgreSQL)", () => {
  beforeAll(async () => { vi.clearAllMocks(); await resetDatabase(prisma); }); beforeEach(() => { vi.clearAllMocks(); });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------
  // Reschedule
  // ---------------------------------------------------------------------

  it("case 19: reschedule updates the same appointment id (no new row created)", async () => {
    const { tenant, barber, service, client, owner } = await setupTenant("agenda-reschedule-same-id");
    const originalSlot = futureWeekdaySlot(10);
    const newSlot = futureWeekdaySlot(14);

    const created = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: originalSlot,
      duration: service.duration,
      price: service.price,
    });

    const updated = await rescheduleAppointmentWithConflictGuard({
      tenantId: tenant.id,
      appointmentId: created.id,
      scheduledAt: newSlot,
      barberId: barber.id,
      actorUserId: owner.id,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.scheduledAt.getTime()).toBe(newSlot.getTime());
    expect(await prisma.appointment.count({ where: { tenantId: tenant.id } })).toBe(1);

    const history = await prisma.appointmentHistory.findMany({
      where: { appointmentId: created.id },
    });
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  it("case 20: reschedule into an occupied slot fails and leaves the appointment unchanged", async () => {
    const { tenant, barber, service, client, owner } = await setupTenant("agenda-reschedule-conflict");
    const client2 = await createClient(prisma, tenant.id);
    const slotA = futureWeekdaySlot(10);
    const slotB = futureWeekdaySlot(11);

    const aptA = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: slotA,
      duration: service.duration,
      price: service.price,
    });

    const aptB = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client2.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: slotB,
      duration: service.duration,
      price: service.price,
    });

    expect(aptA.id).toBeTruthy();

    await expect(
      rescheduleAppointmentWithConflictGuard({
        tenantId: tenant.id,
        appointmentId: aptB.id,
        scheduledAt: slotA,
        barberId: barber.id,
        actorUserId: owner.id,
      })
    ).rejects.toThrow("Horário indisponível para este profissional");

    const reloaded = await prisma.appointment.findUniqueOrThrow({ where: { id: aptB.id } });
    expect(reloaded.scheduledAt.getTime()).toBe(slotB.getTime());
  });

  it("case 22: reschedule scoped to tenant A cannot touch tenant B's appointment", async () => {
    const tenantScopeA = await setupTenant("agenda-reschedule-tenant-a");
    const tenantScopeB = await setupTenant("agenda-reschedule-tenant-b");
    const slotB = futureWeekdaySlot(10);

    const aptB = await createAppointmentWithConflictGuard({
      tenantId: tenantScopeB.tenant.id,
      clientId: tenantScopeB.client.id,
      serviceId: tenantScopeB.service.id,
      barberId: tenantScopeB.barber.id,
      scheduledAt: slotB,
      duration: tenantScopeB.service.duration,
      price: tenantScopeB.service.price,
    });

    await expect(
      rescheduleAppointmentWithConflictGuard({
        tenantId: tenantScopeA.tenant.id,
        appointmentId: aptB.id,
        scheduledAt: futureWeekdaySlot(15),
        barberId: tenantScopeB.barber.id,
        actorUserId: tenantScopeA.owner.id,
      })
    ).rejects.toThrow("Agendamento não encontrado");

    const reloaded = await prisma.appointment.findUniqueOrThrow({ where: { id: aptB.id } });
    expect(reloaded.scheduledAt.getTime()).toBe(slotB.getTime());
    expect(reloaded.tenantId).toBe(tenantScopeB.tenant.id);
  });

  // ---------------------------------------------------------------------
  // Cancel permissions
  // ---------------------------------------------------------------------

  it("case 21: RECEPTIONIST without agenda:cancel cannot cancel appointments", async () => {
    const { tenant, barber, service, client, receptionist } = await setupTenant(
      "agenda-cancel-receptionist"
    );
    const apt = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: futureWeekdaySlot(10),
      duration: service.duration,
      price: service.price,
    });

    const actor = await asAuthenticatedUser(receptionist);

    await expect(
      updateAppointmentStatusSecure(apt.id, "CANCELLED", actor)
    ).rejects.toBeInstanceOf(AuthError);
    await expect(
      updateAppointmentStatusSecure(apt.id, "CANCELLED", actor)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const reloaded = await prisma.appointment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(reloaded.status).toBe("SCHEDULED");
  });

  it("case 21b: BARBER without agenda:cancel cannot cancel appointments", async () => {
    const { tenant, barber, service, client } = await setupTenant("agenda-cancel-barber");
    const apt = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: futureWeekdaySlot(10),
      duration: service.duration,
      price: service.price,
    });

    const actor = await asAuthenticatedUser(barber);

    await expect(
      updateAppointmentStatusSecure(apt.id, "CANCELLED", actor)
    ).rejects.toBeInstanceOf(AuthError);
    await expect(
      updateAppointmentStatusSecure(apt.id, "CANCELLED", actor)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const reloaded = await prisma.appointment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(reloaded.status).toBe("SCHEDULED");
  });

  // ---------------------------------------------------------------------
  // Membership completion
  // ---------------------------------------------------------------------

  it("case 23: completing an appointment consumes a membership visit atomically", async () => {
    const { tenant, barber, service, client, owner } = await setupTenant("agenda-membership-atomic");
    const plan = await createMembershipPlan(prisma, tenant.id, {
      planType: "MONTHLY_LIMITED",
      maxVisitsPerMonth: 1,
    });
    const membership = await createMembership(prisma, tenant.id, client.id, plan.id);

    const apt = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: futureWeekdaySlot(10),
      duration: service.duration,
      price: service.price,
    });

    const actor = await asAuthenticatedUser(owner);
    await updateAppointmentStatusSecure(apt.id, "COMPLETED", actor);

    const aptReloaded = await prisma.appointment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(aptReloaded.status).toBe("COMPLETED");
    expect(aptReloaded.membershipId).toBe(membership.id);

    const membershipReloaded = await prisma.clientMembership.findUniqueOrThrow({
      where: { id: membership.id },
    });
    expect(membershipReloaded.visitsUsedThisPeriod).toBe(1);
    expect(membershipReloaded.totalVisitsUsed).toBe(1);

    const clientReloaded = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(clientReloaded.lastVisitAt?.getTime()).toBe(apt.scheduledAt.getTime());

    const redemptions = await prisma.membershipRedemption.findMany({
      where: { membershipId: membership.id },
    });
    expect(redemptions).toHaveLength(1);
    expect(redemptions[0]?.appointmentId).toBe(apt.id);
  });

  it("case 24: concurrent completion of two different appointments doesn't lose a membership visit", async () => {
    const { tenant, barber, service, client, owner } = await setupTenant(
      "agenda-membership-concurrent-count"
    );
    const plan = await createMembershipPlan(prisma, tenant.id, {
      planType: "MONTHLY_LIMITED",
      maxVisitsPerMonth: 10,
    });
    const membership = await createMembership(prisma, tenant.id, client.id, plan.id);

    const apt1 = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: futureWeekdaySlot(9),
      duration: service.duration,
      price: service.price,
    });
    const apt2 = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: futureWeekdaySlot(11),
      duration: service.duration,
      price: service.price,
    });

    const actor = await asAuthenticatedUser(owner);

    const results = await Promise.allSettled([
      updateAppointmentStatusSecure(apt1.id, "COMPLETED", actor),
      updateAppointmentStatusSecure(apt2.id, "COMPLETED", actor),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);

    const membershipReloaded = await prisma.clientMembership.findUniqueOrThrow({
      where: { id: membership.id },
    });
    expect(membershipReloaded.visitsUsedThisPeriod).toBe(2);
    expect(membershipReloaded.totalVisitsUsed).toBe(2);

    const redemptions = await prisma.membershipRedemption.count({
      where: { membershipId: membership.id },
    });
    expect(redemptions).toBe(2);
  });

  it("case 25: monthly visit limit is enforced under concurrency (only one of two completions wins)", async () => {
    const { tenant, barber, service, client, owner } = await setupTenant(
      "agenda-membership-limit-concurrency"
    );
    const plan = await createMembershipPlan(prisma, tenant.id, {
      planType: "MONTHLY_LIMITED",
      maxVisitsPerMonth: 1,
    });
    const membership = await createMembership(prisma, tenant.id, client.id, plan.id);

    const apt1 = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: futureWeekdaySlot(9),
      duration: service.duration,
      price: service.price,
    });
    const apt2 = await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: futureWeekdaySlot(11),
      duration: service.duration,
      price: service.price,
    });

    const actor = await asAuthenticatedUser(owner);

    const results = await Promise.allSettled([
      updateAppointmentStatusSecure(apt1.id, "COMPLETED", actor),
      updateAppointmentStatusSecure(apt2.id, "COMPLETED", actor),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const membershipReloaded = await prisma.clientMembership.findUniqueOrThrow({
      where: { id: membership.id },
    });
    expect(membershipReloaded.visitsUsedThisPeriod).toBe(1);

    const appointments = await prisma.appointment.findMany({
      where: { id: { in: [apt1.id, apt2.id] } },
    });
    const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;
    const scheduledCount = appointments.filter((a) => a.status === "SCHEDULED").length;
    expect(completedCount).toBe(1);
    expect(scheduledCount).toBe(1);
  });

  // ---------------------------------------------------------------------
  // Waitlist offers
  // ---------------------------------------------------------------------

  it("case 26: offerSlot uses the given barberId and offerHours", async () => {
    const { tenant, barber, service, client } = await setupTenant("waitlist-offer-options");
    const entry = await joinWaitlist({
      tenantId: tenant.id,
      clientName: client.name,
      clientPhone: client.phone,
      serviceId: service.id,
      clientId: client.id,
    });

    const slot = futureWeekdaySlot(10);
    const before = Date.now();
    const { entry: offered } = await offerSlot(entry.id, slot, {
      tenantId: tenant.id,
      barberId: barber.id,
      offerHours: 5,
    });

    expect(offered.status).toBe("OFFERED");
    expect(offered.offeredBarberId).toBe(barber.id);
    expect(offered.offeredSlotAt?.getTime()).toBe(slot.getTime());
    const expiresAt = offered.offerExpiresAt?.getTime() ?? 0;
    expect(expiresAt).toBeGreaterThan(before + 4.9 * 60 * 60 * 1000);
    expect(expiresAt).toBeLessThan(before + 5.1 * 60 * 60 * 1000);
  });

  it("case 27: offering an already-occupied slot fails", async () => {
    const { tenant, barber, service, client } = await setupTenant("waitlist-offer-occupied");
    const otherClient = await createClient(prisma, tenant.id);
    const slot = futureWeekdaySlot(10);

    await createAppointmentWithConflictGuard({
      tenantId: tenant.id,
      clientId: otherClient.id,
      serviceId: service.id,
      barberId: barber.id,
      scheduledAt: slot,
      duration: service.duration,
      price: service.price,
    });

    const entry = await joinWaitlist({
      tenantId: tenant.id,
      clientName: client.name,
      clientPhone: client.phone,
      serviceId: service.id,
      clientId: client.id,
    });

    await expect(
      offerSlot(entry.id, slot, { tenantId: tenant.id, barberId: barber.id })
    ).rejects.toThrow("Horário indisponível para oferta");

    const reloaded = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(reloaded.status).toBe("PENDING");
  });

  it("case 28: an expired offer cannot be confirmed and is marked EXPIRED", async () => {
    const { tenant, barber, service, client } = await setupTenant("waitlist-offer-expired");
    const rawToken = "expired-token-1234567890";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const slot = futureWeekdaySlot(10);

    const entry = await prisma.waitlistEntry.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        serviceId: service.id,
        barberId: barber.id,
        status: "OFFERED",
        offeredSlotAt: slot,
        offeredBarberId: barber.id,
        offerExpiresAt: addMinutes(new Date(), -5),
        offerTokenHash: tokenHash,
      },
    });

    await expect(confirmWaitlistOffer(rawToken)).rejects.toThrow(/expirou/);

    const reloaded = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(reloaded.status).toBe("EXPIRED");
    expect(await prisma.appointment.count({ where: { waitlistEntryId: entry.id } })).toBe(0);
  });

  it("case 29: a used token cannot be used to confirm a second time", async () => {
    const { tenant, barber, service, client } = await setupTenant("waitlist-token-once");
    const entry = await joinWaitlist({
      tenantId: tenant.id,
      clientName: client.name,
      clientPhone: client.phone,
      serviceId: service.id,
      clientId: client.id,
    });
    const slot = futureWeekdaySlot(10);
    const { token } = await offerSlot(entry.id, slot, { tenantId: tenant.id, barberId: barber.id });

    await confirmWaitlistOffer(token);

    await expect(confirmWaitlistOffer(token)).rejects.toThrow(/já foi confirmada/);
    expect(await prisma.appointment.count({ where: { waitlistEntryId: entry.id } })).toBe(1);
  });

  it("case 30: confirming an offer creates the appointment and marks the entry BOOKED", async () => {
    const { tenant, barber, service, client } = await setupTenant("waitlist-confirm-books");
    const entry = await joinWaitlist({
      tenantId: tenant.id,
      clientName: client.name,
      clientPhone: client.phone,
      serviceId: service.id,
      clientId: client.id,
    });
    const slot = futureWeekdaySlot(10);
    const { token } = await offerSlot(entry.id, slot, { tenantId: tenant.id, barberId: barber.id });

    const result = await confirmWaitlistOffer(token);

    expect(result.appointment.origin).toBe("WAITLIST");
    expect(result.appointment.waitlistEntryId).toBe(entry.id);
    expect(result.appointment.scheduledAt.getTime()).toBe(slot.getTime());

    const reloaded = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(reloaded.status).toBe("BOOKED");
    expect(reloaded.offerTokenUsedAt).not.toBeNull();
  });

  it("case 31: concurrent confirmations of the same token don't double-book", async () => {
    const { tenant, barber, service, client } = await setupTenant("waitlist-confirm-concurrent");
    const entry = await joinWaitlist({
      tenantId: tenant.id,
      clientName: client.name,
      clientPhone: client.phone,
      serviceId: service.id,
      clientId: client.id,
    });
    const slot = futureWeekdaySlot(10);
    const { token } = await offerSlot(entry.id, slot, { tenantId: tenant.id, barberId: barber.id });

    const results = await Promise.allSettled([
      confirmWaitlistOffer(token),
      confirmWaitlistOffer(token),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(await prisma.appointment.count({ where: { waitlistEntryId: entry.id } })).toBe(1);
  });
});
