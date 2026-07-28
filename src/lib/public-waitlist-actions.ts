"use server";

import { prisma } from "@/lib/prisma";
import { confirmWaitlistOffer } from "@/lib/domain/waitlist";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request-ip";

export async function getWaitlistOfferPreview(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const { createHash } = await import("crypto");
  const tokenHash = createHash("sha256").update(trimmed).digest("hex");

  const entry = await prisma.waitlistEntry.findUnique({
    where: { offerTokenHash: tokenHash },
    include: {
      service: { select: { name: true, duration: true, price: true } },
      tenant: { select: { name: true, phone: true, address: true } },
      offeredBarber: { select: { name: true } },
      barber: { select: { name: true } },
    },
  });
  if (!entry) return null;

  const barberName = entry.offeredBarber?.name ?? entry.barber?.name ?? null;

  return {
    status: entry.status,
    alreadyUsed: !!entry.offerTokenUsedAt,
    expired: entry.offerExpiresAt ? entry.offerExpiresAt.getTime() < Date.now() : true,
    tenantName: entry.tenant.name,
    serviceName: entry.service.name,
    barberName,
    clientName: entry.clientName,
    scheduledAt: entry.offeredSlotAt?.toISOString() ?? null,
    expiresAt: entry.offerExpiresAt?.toISOString() ?? null,
  };
}

export async function confirmWaitlistOfferAction(token: string) {
  const ip = await getClientIp();
  await consumeRateLimit({
    scope: "waitlist_confirm",
    identityParts: [ip, token.trim().slice(0, 16)],
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  const result = await confirmWaitlistOffer(token);
  return {
    success: true,
    appointmentId: result.appointment.id,
    scheduledAt: result.scheduledAt.toISOString(),
    serviceName: result.service.name,
    tenantName: result.tenant.name,
  };
}
