import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Decimal } from "@prisma/client/runtime/library";

export function createPrisma() {
  return new PrismaClient();
}

export async function resetDatabase(prisma: PrismaClient) {
  // Order matters for FKs — truncate all public tables
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

export async function createTenant(
  prisma: PrismaClient,
  opts?: { name?: string; slug?: string }
) {
  const slug = opts?.slug ?? `shop-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await prisma.tenant.create({
    data: {
      name: opts?.name ?? `Barbearia ${slug}`,
      slug,
      plan: "PRO",
      active: true,
      settings: {
        create: {
          openTime: "09:00",
          closeTime: "18:00",
          workingDays: "1,2,3,4,5",
          publicBookingEnabled: true,
          timeZone: "America/Sao_Paulo",
        },
      },
    },
  });
  return tenant;
}

export async function createUser(
  prisma: PrismaClient,
  opts: {
    tenantId: string | null;
    role: Role;
    email?: string;
    active?: boolean;
    name?: string;
  }
) {
  const email =
    opts.email ??
    `${opts.role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  return prisma.user.create({
    data: {
      email,
      name: opts.name ?? email.split("@")[0],
      passwordHash: await bcrypt.hash("password123", 4),
      role: opts.role,
      active: opts.active ?? true,
      tenantId: opts.tenantId,
    },
  });
}

export async function createService(
  prisma: PrismaClient,
  tenantId: string,
  opts?: { name?: string; price?: string; duration?: number }
) {
  return prisma.service.create({
    data: {
      tenantId,
      name: opts?.name ?? "Corte",
      price: new Decimal(opts?.price ?? "50.00"),
      duration: opts?.duration ?? 30,
      active: true,
    },
  });
}

export async function createClient(
  prisma: PrismaClient,
  tenantId: string,
  opts?: { name?: string; phone?: string }
) {
  const phone =
    opts?.phone ??
    `119${Math.floor(10000000 + Math.random() * 89999999)}`;
  return prisma.client.create({
    data: {
      tenantId,
      name: opts?.name ?? "Cliente Teste",
      phone,
    },
  });
}
