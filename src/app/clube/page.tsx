import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, isTenantAdmin, requireTenantId } from "@/lib/auth-utils";
import {
  getMembershipPlans,
  getActiveMemberships,
  getClientsForSubscribe,
} from "@/lib/membership-actions";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import {
  MembershipPlanForm,
  SubscribeClientForm,
  PlansList,
  MembershipsList,
} from "@/components/clube/clube-panel";
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
      <div className="animate-fade-in space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Clube de Assinatura</h1>
            <p className="text-sm text-zinc-400">
              Crie planos mensais, pacotes e fidelidade — você define as regras
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <SubscribeClientForm plans={serializedPlans} clients={clients} />
            <MembershipPlanForm />
          </div>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Planos disponíveis</h2>
          <PlansList plans={serializedPlans} />
          {plans.length === 0 && (
            <p className="text-zinc-500 text-sm">
              Crie seu primeiro plano: mensal com X cortes, ilimitado, pacote ou fidelidade.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Clientes inscritos ({memberships.length})
          </h2>
          <MembershipsList memberships={serializedMemberships} />
        </section>
      </div>
    </TenantAppShell>
  );
}
