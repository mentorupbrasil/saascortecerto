import "server-only";

export { ensurePrimaryLocation } from "@/lib/finance/cash";
import { prisma } from "@/lib/prisma";

export async function listLocations(tenantId: string) {
  return prisma.location.findMany({
    where: { tenantId, active: true },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
}

export async function getPrimaryLocation(tenantId: string) {
  const { ensurePrimaryLocation } = await import("@/lib/finance/cash");
  return ensurePrimaryLocation(tenantId);
}
