import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/auth-utils";
import { AuthError } from "@/lib/authz";
import { getComissoesPanelData } from "@/lib/finance-actions";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { ComissoesPanel } from "@/components/finance/comissoes-panel";
import { Percent } from "lucide-react";

export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  const { period } = await searchParams;

  try {
    const data = await getComissoesPanelData(period);

    return (
      <TenantAppShell>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Percent className="h-7 w-7 text-amber-400" />
              Comissões
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Regras de comissão e lançamentos imutáveis por venda fechada.
            </p>
          </div>
          <ComissoesPanel data={data} />
        </div>
      </TenantAppShell>
    );
  } catch (err) {
    if (err instanceof AuthError && err.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw err;
  }
}
