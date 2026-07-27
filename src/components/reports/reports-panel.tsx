"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { exportReportCsvAction } from "@/lib/crm-actions";
import type { ReportMetrics } from "@/lib/reports/metrics";

const PERIODS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "month", label: "Este mês" },
] as const;

export function ReportsPanel({
  metrics,
  period,
  canExport,
}: {
  metrics: ReportMetrics;
  period: string;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setPeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`/relatorios?${params.toString()}`);
  }

  function handleExport() {
    startTransition(async () => {
      const result = await exportReportCsvAction(
        period as "7d" | "30d" | "90d" | "month"
      );
      if (!result?.csv) return;
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              period === p.value
                ? "bg-amber-500/10 text-amber-400"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
        {canExport && (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={handleExport}
            className="ml-auto"
          >
            {pending ? "Exportando..." : "Exportar CSV"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Receita"
          value={formatCurrency(metrics.revenue.total)}
          sub={`${metrics.revenue.paymentCount} pagamentos`}
        />
        <MetricCard
          label="Ocupação"
          value={`${(metrics.occupancy.rate * 100).toFixed(1)}%`}
          sub={`${metrics.occupancy.bookedMinutes} min agendados`}
        />
        <MetricCard
          label="No-show"
          value={`${(metrics.appointments.noShowRate * 100).toFixed(1)}%`}
          sub={`${metrics.appointments.noShow} de ${metrics.appointments.total}`}
        />
        <MetricCard
          label="Clientes"
          value={String(metrics.clients.uniqueServed)}
          sub={`${metrics.clients.newClients} novos · ${metrics.clients.returningClients} retornantes`}
        />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Receita por forma de pagamento</h2>
        <div className="space-y-2">
          {Object.entries(metrics.revenue.byMethod).map(([method, amount]) => (
            <div key={method} className="flex justify-between text-sm">
              <span className="text-zinc-400">{method}</span>
              <span className="text-white font-medium">{formatCurrency(amount)}</span>
            </div>
          ))}
          {Object.keys(metrics.revenue.byMethod).length === 0 && (
            <p className="text-zinc-500 text-sm">Nenhum pagamento no período</p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Agendamentos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <StatBlock label="Total" value={metrics.appointments.total} />
          <StatBlock label="Concluídos" value={metrics.appointments.completed} />
          <StatBlock label="Cancelados" value={metrics.appointments.cancelled} />
          <StatBlock label="No-show" value={metrics.appointments.noShow} />
        </div>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{sub}</p>
    </Card>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
