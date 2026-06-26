import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canManageTenants } from "@/lib/auth-utils";
import { getPlatformBillingStats } from "@/lib/admin-actions";
import { AppShell } from "@/components/layout/sidebar";
import { Card } from "@/components/ui/card";
import { TenantFormModal } from "@/components/admin/tenant-form";
import { ToggleTenantButton } from "@/components/admin/toggle-tenant";
import { AdminBillingPanel } from "@/components/admin/billing-panel";
import { formatPlanPrice } from "@/lib/plan-pricing";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageTenants(user)) redirect("/dashboard");

  const billing = await getPlatformBillingStats();

  const tenantRows = billing.tenants.map((t) => ({
    id: t.id,
    name: t.name,
    plan: t.plan as "FREE" | "PRO" | "CLUBE",
    active: t.active,
    ownerEmail: t.users[0]?.email ?? null,
  }));

  const paymentRows = billing.payments.map((p) => ({
    id: p.id,
    tenantName: p.tenant.name,
    plan: p.plan,
    amount: Number(p.amount),
    status: p.status,
    dueDate: p.dueDate.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
    tenantReportedPaidAt: p.tenantReportedPaidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <AppShell>
      <div className="animate-fade-in space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Plataforma</h1>
            <p className="text-sm text-zinc-400">
              Faturamento do SaaS · Pro {formatPlanPrice("PRO")}/mês (manual) · Completo{" "}
              {formatPlanPrice("CLUBE")}/mês (automático)
            </p>
          </div>
          <TenantFormModal />
        </div>

        <AdminBillingPanel
          mrr={billing.mrr}
          revenueThisMonth={billing.revenueThisMonth}
          pendingCount={billing.pendingCount}
          pendingAmount={billing.pendingAmount}
          tenants={tenantRows}
          payments={paymentRows}
        />

        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Barbearias cadastradas</h2>
          <div className="space-y-3">
            {billing.tenants.map((tenant) => (
              <Card key={tenant.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-lg font-semibold text-white">{tenant.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          tenant.active
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {tenant.active ? "Ativa" : "Inativa"}
                      </span>
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                        {tenant.plan}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">
                      {tenant.slug} · {tenant.users[0]?.email ?? "—"}
                    </p>
                    <div className="mt-2 flex gap-4 text-xs text-zinc-400">
                      <span>{tenant._count.users} usuários</span>
                      <span>{tenant._count.clients} clientes</span>
                      <span>{tenant._count.appointments} agendamentos</span>
                    </div>
                  </div>
                  <ToggleTenantButton tenantId={tenant.id} active={tenant.active} />
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
