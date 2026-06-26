import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, requireTenantId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/sidebar";
import { Card } from "@/components/ui/card";
import { ClientFormModal, ClientAvatar } from "@/components/clients/client-form";
import { formatPhone } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function ClientesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  const tenantId = requireTenantId(user);

  const clients = await prisma.client.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { appointments: true, memberships: { where: { status: "ACTIVE" } } } },
    },
  });

  return (
    <AppShell>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Clientes</h1>
            <p className="text-sm text-zinc-400">{clients.length} cadastrados</p>
          </div>
          <ClientFormModal />
        </div>

        <div className="grid gap-3">
          {clients.map((client) => (
            <Card key={client.id} hover>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ClientAvatar name={client.name} photoUrl={client.photoUrl} />
                  <div>
                    <p className="font-semibold text-white">{client.name}</p>
                    <p className="text-sm text-zinc-400">{formatPhone(client.phone)}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                      {client.birthday && (
                        <span>
                          🎂 {format(client.birthday, "dd/MM", { locale: ptBR })}
                        </span>
                      )}
                      {client.lastVisitAt && (
                        <span>
                          ✂️ Último:{" "}
                          {format(client.lastVisitAt, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      <span>↩️ Retorno: {client.returnDays}d</span>
                      {client._count.memberships > 0 && (
                        <span className="text-amber-400">👑 Clube</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">
                    {client._count.appointments} visitas
                  </p>
                  <ClientFormModal client={client} edit />
                </div>
              </div>
              {client.notes && (
                <p className="mt-3 text-sm text-zinc-500 border-t border-zinc-800 pt-3">
                  {client.notes}
                </p>
              )}
            </Card>
          ))}

          {clients.length === 0 && (
            <Card>
              <p className="py-8 text-center text-zinc-500">
                Nenhum cliente cadastrado ainda
              </p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
