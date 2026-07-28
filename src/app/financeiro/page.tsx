import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/auth-utils";
import { AuthError } from "@/lib/authz";
import { getFinanceOverview, getExpensesPanelData } from "@/lib/finance-actions";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { FinanceiroOverview } from "@/components/finance/financeiro-overview";
import { ExpensesSection } from "@/components/finance/expenses-section";
import { Wallet } from "lucide-react";

export default async function FinanceiroPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");

  try {
    const overview = await getFinanceOverview();
    const expenses = await getExpensesPanelData();

    return (
      <TenantAppShell>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-7 w-7 text-amber-400" />
              Financeiro
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Visão operacional da barbearia — vendas, caixa e despesas.
            </p>
          </div>

          <FinanceiroOverview data={overview} />
          <ExpensesSection data={expenses} />
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
