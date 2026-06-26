"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import {
  canManageTenants,
  canManageUsers,
  getAppointmentFilter,
  isSuperAdmin,
  isTenantAdmin,
  requireTenantId,
} from "@/lib/auth-utils";
import bcrypt from "bcryptjs";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import type { AppointmentStatus, PaymentMethod, Role } from "@prisma/client";
import {
  addMinutes,
  endOfDay,
  parseISO,
  startOfDay,
  startOfWeek,
  endOfWeek,
} from "date-fns";

const appointmentSchema = z.object({
  clientName: z.string().min(2),
  clientPhone: z.string().min(10),
  serviceId: z.string(),
  barberId: z.string().optional(),
  scheduledAt: z.string(),
  paymentMethod: z.enum(["PIX", "CASH", "CARD"]).optional(),
  notes: z.string().optional(),
});

const clientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  birthday: z.string().optional(),
  notes: z.string().optional(),
  returnDays: z.coerce.number().min(7).max(60).optional(),
});

const serviceSchema = z.object({
  name: z.string().min(2),
  price: z.coerce.number().positive(),
  duration: z.coerce.number().min(5).max(240),
});

const tenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  plan: z.enum(["FREE", "PRO", "CLUBE"]).optional(),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
});

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["OWNER", "MANAGER", "BARBER", "RECEPTIONIST"]),
});

function revalidateDashboard() {
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/clientes");
  revalidatePath("/whatsapp");
  revalidatePath("/clube");
}

export async function createAppointment(formData: FormData) {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  const parsed = appointmentSchema.parse({
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    serviceId: formData.get("serviceId"),
    barberId: formData.get("barberId") || undefined,
    scheduledAt: formData.get("scheduledAt"),
    paymentMethod: formData.get("paymentMethod") || undefined,
    notes: formData.get("notes") || undefined,
  });

  const phone = parsed.clientPhone.replace(/\D/g, "");
  const service = await prisma.service.findFirst({
    where: { id: parsed.serviceId, tenantId, active: true },
  });
  if (!service) throw new Error("Serviço não encontrado");

  let client = await prisma.client.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
  });

  if (!client) {
    client = await prisma.client.create({
      data: { tenantId, name: parsed.clientName, phone },
    });
  } else if (client.name !== parsed.clientName) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: { name: parsed.clientName },
    });
  }

  const barberId =
    user.role === "BARBER"
      ? user.id
      : parsed.barberId || undefined;

  await prisma.appointment.create({
    data: {
      tenantId,
      clientId: client.id,
      serviceId: service.id,
      barberId,
      scheduledAt: parseISO(parsed.scheduledAt),
      duration: service.duration,
      price: service.price,
      paymentMethod: parsed.paymentMethod as PaymentMethod | undefined,
      notes: parsed.notes,
    },
  });

  revalidateDashboard();
  return { success: true };
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  const filter = getAppointmentFilter(user);

  await prisma.appointment.updateMany({
    where: { id, tenantId, ...filter },
    data: {
      status,
      ...(status === "COMPLETED" ? {} : {}),
    },
  });

  if (status === "COMPLETED") {
    const apt = await prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (apt) {
      await prisma.client.update({
        where: { id: apt.clientId },
        data: { lastVisitAt: apt.scheduledAt },
      });

      if (apt.membershipId) {
        const { recordMembershipVisit } = await import("@/lib/membership-actions");
        await recordMembershipVisit(apt.membershipId);
      } else {
        const activeMembership = await prisma.clientMembership.findFirst({
          where: { clientId: apt.clientId, tenantId, status: "ACTIVE" },
        });
        if (activeMembership) {
          const { recordMembershipVisit } = await import("@/lib/membership-actions");
          await recordMembershipVisit(activeMembership.id);
          await prisma.appointment.update({
            where: { id: apt.id },
            data: { membershipId: activeMembership.id },
          });
        }
      }
    }
  }

  revalidateDashboard();
  return { success: true };
}

export async function deleteAppointment(id: string) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  await prisma.appointment.deleteMany({
    where: { id, tenantId },
  });

  revalidateDashboard();
  return { success: true };
}

export async function createClient(formData: FormData) {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  const parsed = clientSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    birthday: formData.get("birthday") || undefined,
    notes: formData.get("notes") || undefined,
    returnDays: formData.get("returnDays") || 20,
  });

  const phone = parsed.phone.replace(/\D/g, "");

  const client = await prisma.client.create({
    data: {
      tenantId,
      name: parsed.name,
      phone,
      birthday: parsed.birthday ? parseISO(parsed.birthday) : null,
      notes: parsed.notes,
      returnDays: parsed.returnDays ?? 20,
    },
  });

  revalidatePath("/clientes");
  return { success: true, id: client.id };
}

export async function updateClient(id: string, formData: FormData) {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  const parsed = clientSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    birthday: formData.get("birthday") || undefined,
    notes: formData.get("notes") || undefined,
    returnDays: formData.get("returnDays") || 20,
  });

  await prisma.client.updateMany({
    where: { id, tenantId },
    data: {
      name: parsed.name,
      phone: parsed.phone.replace(/\D/g, ""),
      birthday: parsed.birthday ? parseISO(parsed.birthday) : null,
      notes: parsed.notes,
      returnDays: parsed.returnDays ?? 20,
    },
  });

  revalidatePath("/clientes");
  return { success: true };
}

export async function createService(formData: FormData) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  const parsed = serviceSchema.parse({
    name: formData.get("name"),
    price: formData.get("price"),
    duration: formData.get("duration"),
  });

  await prisma.service.create({
    data: {
      tenantId,
      name: parsed.name,
      price: parsed.price,
      duration: parsed.duration,
    },
  });

  revalidatePath("/servicos");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleService(id: string, active: boolean) {
  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  await prisma.service.updateMany({
    where: { id, tenantId },
    data: { active },
  });

  revalidatePath("/servicos");
  return { success: true };
}

export async function createTenant(formData: FormData) {
  const user = await requireAuth();
  if (!canManageTenants(user)) throw new Error("Sem permissão");

  const parsed = tenantSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug") || slugify(String(formData.get("name"))),
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    plan: formData.get("plan") || "FREE",
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    ownerPassword: formData.get("ownerPassword"),
  });

  const slug = parsed.slug ?? slugify(parsed.name);
  const passwordHash = await bcrypt.hash(parsed.ownerPassword, 12);

  await prisma.tenant.create({
    data: {
      name: parsed.name,
      slug,
      phone: parsed.phone,
      address: parsed.address,
      plan: parsed.plan,
      settings: { create: {} },
      services: {
        create: [
          { name: "Corte", price: 45, duration: 30, sortOrder: 1 },
          { name: "Barba", price: 35, duration: 20, sortOrder: 2 },
          { name: "Corte + Barba", price: 70, duration: 50, sortOrder: 3 },
          { name: "Pigmentação", price: 80, duration: 40, sortOrder: 4 },
          { name: "Sobrancelha", price: 25, duration: 15, sortOrder: 5 },
        ],
      },
      users: {
        create: {
          email: parsed.ownerEmail.toLowerCase(),
          name: parsed.ownerName,
          passwordHash,
          role: "OWNER",
        },
      },
    },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function createTenantUser(tenantId: string, formData: FormData) {
  const user = await requireAuth();
  if (!canManageUsers(user)) throw new Error("Sem permissão");

  if (!isSuperAdmin(user) && user.tenantId !== tenantId) {
    throw new Error("Sem permissão para esta barbearia");
  }

  const parsed = userSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  await prisma.user.create({
    data: {
      tenantId,
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      passwordHash,
      role: parsed.role as Role,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/equipe");
  return { success: true };
}

export async function toggleUserActive(userId: string, active: boolean) {
  const user = await requireAuth();
  if (!canManageUsers(user)) throw new Error("Sem permissão");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("Usuário não encontrado");

  if (!isSuperAdmin(user) && target.tenantId !== user.tenantId) {
    throw new Error("Sem permissão");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { active },
  });

  revalidatePath("/admin");
  revalidatePath("/equipe");
  return { success: true };
}

export async function toggleTenantActive(tenantId: string, active: boolean) {
  const user = await requireAuth();
  if (!canManageTenants(user)) throw new Error("Sem permissão");

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { active },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function getTodayStats() {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);
  const filter = getAppointmentFilter(user);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      scheduledAt: { gte: todayStart, lte: todayEnd },
      ...filter,
    },
    include: {
      client: true,
      service: true,
      barber: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const revenue = completed.reduce((sum, a) => sum + Number(a.price), 0);

  return {
    appointments,
    revenue,
    clientsServed: completed.length,
  };
}

export async function getWeekAppointments(dateStr: string) {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);
  const filter = getAppointmentFilter(user);

  const date = parseISO(dateStr);
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

  return prisma.appointment.findMany({
    where: {
      tenantId,
      scheduledAt: { gte: weekStart, lte: weekEnd },
      status: { not: "CANCELLED" },
      ...filter,
    },
    include: {
      client: true,
      service: true,
      barber: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });
}

export async function getAvailableSlots(dateStr: string, duration: number) {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  });

  const openTime = settings?.openTime ?? "08:00";
  const closeTime = settings?.closeTime ?? "20:00";

  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);

  const day = startOfDay(parseISO(dateStr));
  const dayStart = setTime(day, openH, openM);
  const dayEnd = setTime(day, closeH, closeM);

  const existing = await prisma.appointment.findMany({
    where: {
      tenantId,
      scheduledAt: { gte: dayStart, lt: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { scheduledAt: true, duration: true },
  });

  const slots: string[] = [];
  let current = dayStart;

  while (addMinutes(current, duration) <= dayEnd) {
    const slotEnd = addMinutes(current, duration);
    const conflict = existing.some((apt) => {
      const aptStart = apt.scheduledAt;
      const aptEnd = addMinutes(aptStart, apt.duration);
      return current < aptEnd && slotEnd > aptStart;
    });

    if (!conflict && current > new Date()) {
      slots.push(current.toISOString());
    }

    current = addMinutes(current, 30);
  }

  return slots;
}

function setTime(date: Date, hours: number, minutes: number) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export async function getClientsAtRisk() {
  const user = await requireAuth();
  const tenantId = requireTenantId(user);

  const clients = await prisma.client.findMany({
    where: { tenantId, lastVisitAt: { not: null } },
  });

  const now = new Date();
  return clients
    .filter((c) => {
      if (!c.lastVisitAt) return false;
      const daysSince = Math.floor(
        (now.getTime() - c.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSince >= c.returnDays;
    })
    .map((c) => ({
      ...c,
      daysSince: Math.floor(
        (now.getTime() - (c.lastVisitAt?.getTime() ?? 0)) / (1000 * 60 * 60 * 24)
      ),
    }));
}
