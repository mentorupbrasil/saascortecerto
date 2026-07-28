import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import {
  getMembershipPlans,
  getActiveMemberships,
  getClientsForSubscribe,
} from "@/lib/membership-actions";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { ClubePanel } from "@/components/clube/clube-panel";
import {
  serializeMembershipForClient,
  serializePlanForClient,
} from "@/lib/serialize";

export default async function ClubePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");
  if (!isTenantAdmin(user)) redirect("/dashboard");

  requireTenantId(user);

  const [plans, memberships, clients] = await Promise.all([
    getMembershipPlans(),
    getActiveMemberships(),
    getClientsForSubscribe(),
  ]);

  const serializedPlans = plans.map(serializePlanForClient);
  const serializedMemberships = memberships.map(serializeMembershipForClient);

  return (
    <TenantAppShell>
      <div className="animate-fade-in space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clube de Assinatura</h1>
          <p className="text-sm text-zinc-400">
            Crie planos mensais, pacotes e fidelidade — você define as regras
          </p>
        </div>

        <ClubePanel
          plans={serializedPlans}
          memberships={serializedMemberships}
          clients={clients}
        />
      </div>
    </TenantAppShell>
  );
}
