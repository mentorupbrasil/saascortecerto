import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isSuperAdmin, requireTenantId } from "@/lib/auth-utils";
import { TenantAppShell } from "@/components/layout/tenant-shell";
import { ReportsPanel } from "@/components/reports/reports-panel";
import { getReportMetrics } from "@/lib/reports/metrics";
import type { ReportPeriod } from "@/lib/reports/metrics";

const REPORTS_ROLES = new Set(["OWNER", "MANAGER", "SUPER_ADMIN"]);

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSuperAdmin(user) && !user.tenantId) redirect("/admin");
  if (!REPORTS_ROLES.has(user.role)) redirect("/dashboard");

  const tenantId = requireTenantId(user);

  const params = await searchParams;
  const period = (params.period ?? "30d") as ReportPeriod;
  const validPeriods: ReportPeriod[] = ["7d", "30d", "90d", "month"];
  const safePeriod = validPeriods.includes(period) ? period : "30d";

  const metrics = await getReportMetrics(tenantId, safePeriod);

  const canExport =
    user.role === "OWNER" ||
    user.role === "MANAGER" ||
    user.role === "SUPER_ADMIN";

  return (
    <TenantAppShell>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-sm text-zinc-400">
            Receita via pagamentos de venda, ocupação e retenção de clientes
          </p>
        </div>
        <ReportsPanel
          metrics={metrics}
          period={safePeriod}
          canExport={canExport}
        />
      </div>
    </TenantAppShell>
  );
}
