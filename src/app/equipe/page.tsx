import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import {
  isSuperAdmin,
  canManageUsers,
  requireTenantId,
} from "@/lib/auth-utils";
import type { UserRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { TeamList } from "@/components/team/team-list";

export default async function EquipePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");
  if (!canManageUsers(user)) redirect("/dashboard");

  const tenantId = requireTenantId(user);

  const [team, tenant] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ]);

  return (
    <TenantAppShell>
      <div className="animate-fade-in">
        <TeamList
          tenantId={tenantId}
          tenantName={tenant?.name ?? "Barbearia"}
          currentUserId={user.id}
          members={team.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role as UserRole,
            active: member.active,
          }))}
        />
      </div>
    </TenantAppShell>
  );
}
