import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import {
  isSuperAdmin,
  canManageUsers,
  requireTenantId,
  ROLE_LABELS,
} from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/sidebar";
import { Card } from "@/components/ui/card";
import { TeamUserForm } from "@/components/team/team-form";
import { ToggleUserButton } from "@/components/team/toggle-user";

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
    <AppShell>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Equipe</h1>
            <p className="text-sm text-zinc-400">{tenant?.name}</p>
          </div>
          <TeamUserForm tenantId={tenantId} />
        </div>

        <div className="space-y-3">
          {team.map((member) => (
            <Card key={member.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{member.name}</p>
                  <p className="text-sm text-zinc-400">{member.email}</p>
                  <span className="mt-1 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-amber-400">
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {member.id !== user.id && (
                    <ToggleUserButton userId={member.id} active={member.active} />
                  )}
                  {member.id === user.id && (
                    <span className="text-xs text-zinc-500">Você</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
