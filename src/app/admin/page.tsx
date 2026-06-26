import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { canManageTenants } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/sidebar";
import { Card, StatCard } from "@/components/ui/card";
import { TenantFormModal } from "@/components/admin/tenant-form";
import { ToggleTenantButton } from "@/components/admin/toggle-tenant";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageTenants(user)) redirect("/dashboard");

  const tenants = await prisma.tenant.findMany({
    include: {
      _count: { select: { users: true, clients: true, appointments: true } },
      users: { where: { role: "OWNER" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.active).length,
    users: tenants.reduce((s, t) => s + t._count.users, 0),
  };

  return (
    <AppShell>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Plataforma</h1>
            <p className="text-sm text-zinc-400">
              Gerencie barbearias — cada uma vê só os dados dela
            </p>
          </div>
          <TenantFormModal />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Barbearias" value={stats.total} />
          <StatCard label="Ativas" value={stats.active} accent />
          <StatCard label="Usuários total" value={stats.users} />
        </div>

        <div className="space-y-3">
          {tenants.map((tenant) => (
            <Card key={tenant.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
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
                    slug: {tenant.slug} · Dono:{" "}
                    {tenant.users[0]?.email ?? "—"}
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

        <Card className="border-zinc-700">
          <h3 className="font-semibold text-white mb-3">Como funciona o multi-tenant</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>✅ Cada barbearia tem um <strong className="text-zinc-300">tenant_id</strong> isolado no banco</li>
            <li>✅ Usuários só acessam dados da barbearia vinculada ao login</li>
            <li>✅ Dono cria logins da equipe (barbeiro, recepcionista, gerente)</li>
            <li>✅ Barbeiro vê só os próprios agendamentos</li>
            <li>✅ Admin plataforma cria novas barbearias e donos</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
