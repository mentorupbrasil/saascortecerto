import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/auth-utils";
import { AuthError } from "@/lib/authz";
import { getCashPanelData } from "@/lib/finance-actions";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { CaixaPanel } from "@/components/finance/caixa-panel";
import { Banknote } from "lucide-react";

export default async function CaixaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  try {
    const data = await getCashPanelData();

    return (
      <TenantAppShell>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Banknote className="h-7 w-7 text-amber-400" />
              Caixa
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Abra e feche o caixa da unidade. Suprimentos e sangrias ficam registrados aqui.
            </p>
          </div>
          <CaixaPanel data={data} />
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
