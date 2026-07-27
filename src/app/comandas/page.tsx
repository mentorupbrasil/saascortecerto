import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/auth-utils";
import { AuthError } from "@/lib/authz";
import { getComandasPanelData } from "@/lib/finance-actions";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { ComandasPanel } from "@/components/finance/comandas-panel";
import { ShoppingCart } from "lucide-react";

export default async function ComandasPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  try {
    const data = await getComandasPanelData();

    return (
      <TenantAppShell>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShoppingCart className="h-7 w-7 text-amber-400" />
              Comandas
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Registre vendas de serviços e produtos. A receita entra aqui — concluir agendamento não lança venda automaticamente.
            </p>
          </div>
          <ComandasPanel data={data} />
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
