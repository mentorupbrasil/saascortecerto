"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/booking-slots";
import { canUseAutoWhatsApp } from "@/lib/plan-pricing";
import { buildWhatsAppUrl, renderMessageTemplate, sendWhatsAppText } from "@/lib/whatsapp";
import { formatCurrency, formatPhone } from "@/lib/utils";
import { z } from "zod";
import { parseISO, startOfDay, endOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const publicBookingSchema = z.object({
  clientName: z.string().min(2),
  clientPhone: z.string().min(10),
  serviceId: z.string(),
  barberId: z.string().optional(),
  scheduledAt: z.string(),
});

export async function getPublicBookingPage(slug: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { slug, active: true },
    include: {
      settings: true,
      services: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      users: {
        where: { role: "BARBER", active: true },
        select: { id: true, name: true },
      },
    },
  });

  if (!tenant) return null;
  if (tenant.settings && !tenant.settings.publicBookingEnabled) return null;

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    phone: tenant.phone,
    address: tenant.address,
    openTime: tenant.settings?.openTime ?? "08:00",
    closeTime: tenant.settings?.closeTime ?? "20:00",
    workingDays: tenant.settings?.workingDays ?? "1,2,3,4,5,6",
    services: tenant.services.map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
      duration: s.duration,
    })),
    barbers: tenant.users,
  };
}

export async function getPublicAvailableSlots(
  slug: string,
  dateStr: string,
  serviceId: string,
  barberId?: string
) {
  const tenant = await getPublicBookingPage(slug);
  if (!tenant) throw new Error("Barbearia não encontrada");

  const service = tenant.services.find((s) => s.id === serviceId);
  if (!service) throw new Error("Serviço não encontrado");

  const date = parseISO(dateStr);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: tenant.id,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { not: "CANCELLED" },
    },
    select: { scheduledAt: true, duration: true, barberId: true },
  });

  const slots = getAvailableSlots({
    date,
    openTime: tenant.openTime,
    closeTime: tenant.closeTime,
    workingDays: tenant.workingDays,
    serviceDuration: service.duration,
    appointments: appointments.map((a) => ({
      scheduledAt: a.scheduledAt,
      duration: a.duration,
      barberId: a.barberId,
    })),
    barberId: barberId || null,
    barberIds: tenant.barbers.map((b) => b.id),
  });

  return slots;
}

async function notifyBarbershopBooking(options: {
  tenantId: string;
  tenantName: string;
  plan: "FREE" | "PRO" | "CLUBE";
  clientName: string;
  clientPhone: string;
  serviceName: string;
  scheduledAt: Date;
  price: number;
}) {
  const [settings, tenant] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId: options.tenantId } }),
    prisma.tenant.findUnique({
      where: { id: options.tenantId },
      select: { phone: true },
    }),
  ]);

  const notifyPhone = (settings?.bookingNotifyPhone || tenant?.phone || "").replace(/\D/g, "");
  if (!notifyPhone) {
    return { notified: false, waUrl: null };
  }

  const when = format(options.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const message = renderMessageTemplate(
    "📅 *Novo agendamento online!*\n\nCliente: {nome}\nTel: {telefone}\nServiço: {servico}\nHorário: {horario}\nValor: {valor}\n\n— CorteCerto",
    {
      nome: options.clientName,
      telefone: formatPhone(options.clientPhone),
      servico: options.serviceName,
      horario: when,
      valor: formatCurrency(options.price),
    }
  );

  let status: "SENT" | "SIMULATED" | "FAILED" | "PENDING" = "PENDING";
  let error: string | undefined;

  if (settings && canUseAutoWhatsApp(options.plan) && settings.whatsappEnabled) {
    const result = await sendWhatsAppText(settings, notifyPhone, message);
    if (result.success) {
      status = result.simulated ? "SIMULATED" : "SENT";
    } else {
      status = "FAILED";
      error = result.error;
    }
  }

  await prisma.whatsAppMessage.create({
    data: {
      tenantId: options.tenantId,
      phone: notifyPhone,
      message,
      type: "CONFIRMATION",
      status,
      error,
      sentAt: status === "SENT" || status === "SIMULATED" ? new Date() : null,
    },
  });

  return {
    notified: status === "SENT" || status === "SIMULATED",
    waUrl: buildWhatsAppUrl(notifyPhone, message),
  };
}

export async function createPublicBooking(slug: string, formData: FormData) {
  const parsed = publicBookingSchema.parse({
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    serviceId: formData.get("serviceId"),
    barberId: formData.get("barberId") || undefined,
    scheduledAt: formData.get("scheduledAt"),
  });

  const tenant = await prisma.tenant.findFirst({
    where: { slug, active: true },
    include: { settings: true },
  });

  if (!tenant) throw new Error("Barbearia não encontrada");
  if (tenant.settings && !tenant.settings.publicBookingEnabled) {
    throw new Error("Agendamento online desativado");
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.serviceId, tenantId: tenant.id, active: true },
  });
  if (!service) throw new Error("Serviço inválido");

  const scheduledAt = parseISO(parsed.scheduledAt);
  const phone = parsed.clientPhone.replace(/\D/g, "");

  const dayAppointments = await prisma.appointment.findMany({
    where: {
      tenantId: tenant.id,
      scheduledAt: {
        gte: startOfDay(scheduledAt),
        lte: endOfDay(scheduledAt),
      },
      status: { not: "CANCELLED" },
    },
    select: { scheduledAt: true, duration: true, barberId: true },
  });

  const barbers = await prisma.user.findMany({
    where: { tenantId: tenant.id, role: "BARBER", active: true },
    select: { id: true },
  });

  const slots = getAvailableSlots({
    date: scheduledAt,
    openTime: tenant.settings?.openTime ?? "08:00",
    closeTime: tenant.settings?.closeTime ?? "20:00",
    workingDays: tenant.settings?.workingDays ?? "1,2,3,4,5,6",
    serviceDuration: service.duration,
    appointments: dayAppointments,
    barberId: parsed.barberId || null,
    barberIds: barbers.map((b) => b.id),
  });

  const slotMatch = slots.some(
    (s) => new Date(s).getTime() === scheduledAt.getTime()
  );
  if (!slotMatch) throw new Error("Horário não disponível. Escolha outro.");

  let client = await prisma.client.findUnique({
    where: { tenantId_phone: { tenantId: tenant.id, phone } },
  });

  if (!client) {
    client = await prisma.client.create({
      data: { tenantId: tenant.id, name: parsed.clientName, phone },
    });
  } else if (client.name !== parsed.clientName) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: { name: parsed.clientName },
    });
  }

  let barberId = parsed.barberId || null;
  if (!barberId && barbers.length > 0) {
    const freeBarber = barbers.find((b) => {
      const barberApts = dayAppointments.filter((a) => a.barberId === b.id);
      return !barberApts.some((apt) => {
        const aptEnd = new Date(apt.scheduledAt.getTime() + apt.duration * 60000);
        const slotEnd = new Date(scheduledAt.getTime() + service.duration * 60000);
        return scheduledAt < aptEnd && slotEnd > apt.scheduledAt;
      });
    });
    barberId = freeBarber?.id ?? null;
  }

  const appointment = await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      barberId,
      scheduledAt,
      duration: service.duration,
      price: service.price,
      status: "SCHEDULED",
      bookedOnline: true,
      notes: "Agendamento online",
    },
  });

  const notification = await notifyBarbershopBooking({
    tenantId: tenant.id,
    tenantName: tenant.name,
    plan: tenant.plan,
    clientName: client.name,
    clientPhone: phone,
    serviceName: service.name,
    scheduledAt,
    price: Number(service.price),
  });

  revalidatePath("/agenda");
  revalidatePath("/dashboard");

  const clientMessage = renderMessageTemplate(
    "Olá {nome}! Seu horário na {barbearia} está reservado para {horario}. Serviço: {servico}. Te esperamos! ✂️",
    {
      nome: client.name.split(" ")[0],
      barbearia: tenant.name,
      horario: format(scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR }),
      servico: service.name,
    }
  );

  return {
    appointmentId: appointment.id,
    scheduledAt: scheduledAt.toISOString(),
    serviceName: service.name,
    barbershopName: tenant.name,
    clientWaUrl: buildWhatsAppUrl(phone, clientMessage),
    ownerNotified: notification.notified,
    ownerWaUrl: notification.waUrl,
  };
}

export async function updatePublicBookingSettings(formData: FormData) {
  const { requireAuth } = await import("@/lib/session");
  const { isTenantAdmin, requireTenantId } = await import("@/lib/auth-utils");

  const user = await requireAuth();
  if (!isTenantAdmin(user)) throw new Error("Sem permissão");
  const tenantId = requireTenantId(user);

  const publicBookingEnabled = formData.get("publicBookingEnabled") === "on";
  const bookingNotifyPhone = String(formData.get("bookingNotifyPhone") || "").trim() || null;

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: { tenantId, publicBookingEnabled, bookingNotifyPhone },
    update: { publicBookingEnabled, bookingNotifyPhone },
  });

  revalidatePath("/agenda");
  return { success: true };
}
