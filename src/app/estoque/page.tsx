import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/auth-utils";
import { AuthError } from "@/lib/authz";
import { getEstoquePanelData } from "@/lib/finance-actions";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { EstoquePanel } from "@/components/finance/estoque-panel";
import { Package } from "lucide-react";

export default async function EstoquePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  try {
    const data = await getEstoquePanelData();

    return (
      <TenantAppShell>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Package className="h-7 w-7 text-amber-400" />
              Estoque
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Produtos, quantidades e alertas de estoque baixo.
            </p>
          </div>
          <EstoquePanel data={data} />
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
