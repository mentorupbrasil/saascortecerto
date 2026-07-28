"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireTenantUser, AuthError } from "@/lib/authz";
import {
  joinWaitlist,
  offerSlot,
  listWaitlistEntries,
  expireStaleOffers,
} from "@/lib/domain/waitlist";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const WAITLIST_PATH = "/lista-espera";

const joinSchema = z.object({
  clientName: z.string().min(2),
  clientPhone: z.string().min(10),
  serviceId: z.string(),
  barberId: z.string().optional(),
  clientId: z.string().optional(),
  preferredDates: z.string().optional(),
  preferredTimeStart: z.string().optional(),
  preferredTimeEnd: z.string().optional(),
  priority: z.coerce.number().optional(),
  notes: z.string().optional(),
});

function handleAuthError(err: unknown): never {
  if (err instanceof AuthError) {
    throw new Error(err.message);
  }
  throw err;
}

export async function getWaitlistEntriesAction() {
  try {
    const user = await requireTenantUser();
    await requirePermission("agenda:edit");
    await expireStaleOffers(user.tenantId);
    return listWaitlistEntries(user.tenantId);
  } catch (err) {
    handleAuthError(err);
  }
}

export async function joinWaitlistAction(formData: FormData) {
  try {
    const user = await requireTenantUser();
    await requirePermission("agenda:edit");

    const parsed = joinSchema.parse({
      clientName: formData.get("clientName"),
      clientPhone: formData.get("clientPhone"),
      serviceId: formData.get("serviceId"),
      barberId: formData.get("barberId") || undefined,
      clientId: formData.get("clientId") || undefined,
      preferredDates: formData.get("preferredDates") || undefined,
      preferredTimeStart: formData.get("preferredTimeStart") || undefined,
      preferredTimeEnd: formData.get("preferredTimeEnd") || undefined,
      priority: formData.get("priority") || undefined,
      notes: formData.get("notes") || undefined,
    });

    await joinWaitlist({ tenantId: user.tenantId, ...parsed });
    revalidatePath(WAITLIST_PATH);
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function offerWaitlistSlotAction(
  entryId: string,
  slotAtIso: string,
  options?: { barberId?: string | null; offerHours?: number }
) {
  try {
    const user = await requireTenantUser();
    await requirePermission("agenda:edit");

    const slotAt = new Date(slotAtIso);
    if (Number.isNaN(slotAt.getTime())) {
      throw new Error("Horário inválido");
    }

    const { token } = await offerSlot(entryId, slotAt, {
      tenantId: user.tenantId,
      barberId: options?.barberId ?? null,
      offerHours: options?.offerHours,
    });
    revalidatePath(WAITLIST_PATH);
    return { success: true, confirmPath: `/lista-espera/confirmar/${token}` };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function cancelWaitlistEntryAction(entryId: string) {
  try {
    const user = await requireTenantUser();
    await requirePermission("agenda:edit");

    await prisma.waitlistEntry.updateMany({
      where: { id: entryId, tenantId: user.tenantId },
      data: { status: "CANCELLED" },
    });
    revalidatePath(WAITLIST_PATH);
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function getWaitlistFormOptionsAction() {
  try {
    const user = await requireTenantUser();
    await requirePermission("agenda:edit");

    const [services, barbers, clients] = await Promise.all([
      prisma.service.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { tenantId: user.tenantId, active: true, role: "BARBER" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.client.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, phone: true },
        take: 200,
      }),
    ]);

    return { services, barbers, clients };
  } catch (err) {
    handleAuthError(err);
  }
}
