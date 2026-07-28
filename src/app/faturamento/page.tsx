import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, isTenantAdmin } from "@/lib/auth-utils";
import { getTenantBillingForSession } from "@/lib/billing-actions";
import { getPlatformSupportEmail } from "@/lib/platform-billing";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { TenantBillingPanel } from "@/components/billing/tenant-billing-panel";
import { Receipt } from "lucide-react";

export default async function FaturamentoPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");
  if (!isTenantAdmin(user)) redirect("/dashboard");

  const billing = await getTenantBillingForSession();
  if (!billing) redirect("/dashboard");

  return (
    <TenantAppShell>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-7 w-7 text-amber-400" />
            Plano e cobrança
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Assinatura do sistema CorteCerto — faturas da plataforma, separado do financeiro da barbearia.
          </p>
        </div>

        <TenantBillingPanel
          billing={billing}
          isOwner={user.role === "OWNER"}
          supportEmail={getPlatformSupportEmail()}
        />
      </div>
    </TenantAppShell>
  );
}
