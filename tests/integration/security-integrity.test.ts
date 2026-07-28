import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { spawnSync } from "node:child_process";
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
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { POST as uploadClientPhoto } from "@/app/api/upload/client-photo/route";
import { createTenant, createUser, createClient, resetDatabase } from "../factories";

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

function jpegFile(name = "photo.jpg"): File {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 4, 5]);
  return new File([bytes], name, { type: "image/jpeg" });
}

function uploadRequest(clientId: string): NextRequest {
  const form = new FormData();
  form.set("photo", jpegFile());
  form.set("clientId", clientId);
  return new NextRequest("http://localhost/api/upload/client-photo", {
    method: "POST",
    body: form,
  });
}

describe("security integrity (PostgreSQL)", () => {
  beforeAll(async () => { vi.clearAllMocks(); await resetDatabase(prisma); }); beforeEach(() => { vi.clearAllMocks(); });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("case 32: BARBER without clients:manage is rejected uploading a client photo", async () => {
    const tenant = await createTenant(prisma, { slug: "sec-photo-barber" });
    const barber = await createUser(prisma, { tenantId: tenant.id, role: "BARBER" });
    const client = await createClient(prisma, tenant.id);
    mockSession(barber);

    const res = await uploadClientPhoto(uploadRequest(client.id));

    // BARBER lacks clients:manage → FORBIDDEN → 403
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeTruthy();

    const reloaded = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(reloaded.photoUrl).toBeNull();
  });

  it("case 33: OWNER can upload a photo for a client in their own tenant", async () => {
    const tenant = await createTenant(prisma, { slug: "sec-photo-owner" });
    const owner = await createUser(prisma, { tenantId: tenant.id, role: "OWNER" });
    const client = await createClient(prisma, tenant.id);
    mockSession(owner);

    const res = await uploadClientPhoto(uploadRequest(client.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.photoUrl).toMatch(/^data:image\/jpeg;base64,/);

    const reloaded = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(reloaded.photoUrl).toBe(body.photoUrl);

    const auditCount = await prisma.auditLog.count({
      where: { entityId: client.id, action: "client.photo_uploaded" },
    });
    expect(auditCount).toBe(1);
  });

  it("case 34: uploading a photo for another tenant's client fails and leaves it untouched", async () => {
    const tenantA = await createTenant(prisma, { slug: "sec-photo-tenant-a" });
    const tenantB = await createTenant(prisma, { slug: "sec-photo-tenant-b" });
    const ownerA = await createUser(prisma, { tenantId: tenantA.id, role: "OWNER" });
    const clientB = await createClient(prisma, tenantB.id);
    mockSession(ownerA);

    const res = await uploadClientPhoto(uploadRequest(clientB.id));

    expect(res.status).toBe(404);

    const reloaded = await prisma.client.findUniqueOrThrow({ where: { id: clientB.id } });
    expect(reloaded.photoUrl).toBeNull();
    expect(
      await prisma.auditLog.count({ where: { entityId: clientB.id } })
    ).toBe(0);
  });

  it("case 35: the demo seed script is blocked without ALLOW_DEMO_SEED", () => {
    const cwd = process.cwd();
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.ALLOW_DEMO_SEED;

    const result = spawnSync("npx tsx prisma/seed.ts", {
      cwd,
      env,
      encoding: "utf-8",
      shell: true,
    });

    expect(result.status).not.toBe(0);
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(output).toMatch(/Demo seed bloqueado neste ambiente/);
  }, 30_000);

  it("case 36: consumeRateLimit blocks once the limit is exceeded within the window", async () => {
    const scope = `test-scope-limit-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit({ scope, identityParts: ["1.2.3.4"], limit: 3, windowMs: 60_000 });
    }

    await expect(
      consumeRateLimit({ scope, identityParts: ["1.2.3.4"], limit: 3, windowMs: 60_000 })
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("case 37: different tenants (identities) don't share a rate-limit bucket", async () => {
    const scope = `test-scope-tenant-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit({
        scope,
        identityParts: ["tenant-a", "1.2.3.4"],
        limit: 3,
        windowMs: 60_000,
      });
    }

    // Tenant B sharing the same IP is a distinct identity and must not be blocked.
    await expect(
      consumeRateLimit({
        scope,
        identityParts: ["tenant-b", "1.2.3.4"],
        limit: 3,
        windowMs: 60_000,
      })
    ).resolves.toBeUndefined();

    // Tenant A is still blocked on its own bucket.
    await expect(
      consumeRateLimit({
        scope,
        identityParts: ["tenant-a", "1.2.3.4"],
        limit: 3,
        windowMs: 60_000,
      })
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("case 38: RateLimitBucket.keyHash is never the raw IP/phone/email nor contains them", async () => {
    const scope = `test-scope-hash-${Date.now()}`;
    const rawIp = "203.0.113.77";
    const rawPhone = "11999998888";
    const rawEmail = "user@example.com";

    await consumeRateLimit({
      scope,
      identityParts: [rawIp, rawPhone, rawEmail],
      limit: 10,
      windowMs: 60_000,
    });

    const bucket = await prisma.rateLimitBucket.findFirstOrThrow({ where: { scope } });
    expect(bucket.keyHash).not.toBe(rawIp);
    expect(bucket.keyHash).not.toBe(rawPhone);
    expect(bucket.keyHash).not.toBe(rawEmail);
    expect(bucket.keyHash).not.toContain(rawIp);
    expect(bucket.keyHash).not.toContain(rawPhone);
    expect(bucket.keyHash).not.toContain(rawEmail);
    expect(bucket.keyHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
