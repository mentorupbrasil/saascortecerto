"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-chrome";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { exportReportCsvAction } from "@/lib/crm-actions";
import type { ReportDashboardData, ReportPeriod } from "@/lib/reports/metrics";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Users,
  Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "month", label: "Este mês" },
] as const;

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "Pix",
  CASH: "Dinheiro",
  CARD: "Cartão",
};

export function ReportsPanel({
  data,
  period,
  canExport,
}: {
  data: ReportDashboardData;
  period: string;
  canExport: boolean;
}) {
  const { metrics, previous, topServices, barberPerformance, statusEvolution } = data;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function setPeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`/relatorios?${params.toString()}`);
  }

  function handleExport() {
    startTransition(async () => {
      try {
        const result = await exportReportCsvAction(
          period as ReportPeriod
        );
        if (!result?.csv) {
          toast.error("Não foi possível exportar");
          return;
        }
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Relatório exportado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao exportar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                period === p.value
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "bg-zinc-800 text-zinc-400 hover:text-foreground border border-transparent"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {canExport && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={handleExport}
            className="shrink-0 min-h-[44px] hidden sm:inline-flex"
          >
            {pending ? "..." : "CSV"}
          </Button>
        )}
      </div>

      {canExport && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={handleExport}
          className="w-full min-h-[44px] sm:hidden"
        >
          {pending ? "Exportando..." : "Exportar CSV"}
        </Button>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Receita"
          value={formatCurrency(metrics.revenue.total)}
          sub={`${metrics.revenue.paymentCount} pagamentos`}
          current={metrics.revenue.total}
          previous={previous?.revenue.total}
          hasComparison={!!previous}
        />
        <MetricCard
          label="Ocupação"
          value={`${(metrics.occupancy.rate * 100).toFixed(1)}%`}
          sub={`${metrics.occupancy.bookedMinutes} min agendados`}
          current={metrics.occupancy.rate}
          previous={previous?.occupancy.rate}
          hasComparison={!!previous}
          invertTrend
        />
        <MetricCard
          label="No-show"
          value={`${(metrics.appointments.noShowRate * 100).toFixed(1)}%`}
          sub={`${metrics.appointments.noShow} de ${metrics.appointments.total}`}
          current={metrics.appointments.noShowRate}
          previous={previous?.appointments.noShowRate}
          hasComparison={!!previous}
          invertTrend
        />
        <MetricCard
          label="Clientes"
          value={String(metrics.clients.uniqueServed)}
          sub={`${metrics.clients.newClients} novos · ${metrics.clients.returningClients} retornantes`}
          current={metrics.clients.uniqueServed}
          previous={previous?.clients.uniqueServed}
          hasComparison={!!previous}
        />
      </div>

      {!previous && (
        <p className="text-xs text-zinc-500 text-center">
          Comparação com período anterior indisponível — sem dados no período anterior.
        </p>
      )}

      <Card>
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-amber-400" />
          Cancelamentos e no-show
        </h2>
        {statusEvolution.length > 0 ? (
          <EvolutionChart data={statusEvolution} />
        ) : (
          <EmptyState
            title="Sem dados no período"
            description="Não há cancelamentos ou no-shows para exibir."
          />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Scissors className="h-4 w-4 text-amber-400" />
            Top serviços
          </h2>
          {topServices.length > 0 ? (
            <BarList
              items={topServices.map((s) => ({
                label: s.name,
                value: s.count,
              }))}
              valueSuffix=" atend."
            />
          ) : (
            <EmptyState
              title="Sem serviços"
              description="Nenhum atendimento concluído no período."
            />
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-400" />
            Desempenho por profissional
          </h2>
          {barberPerformance.length > 0 ? (
            <BarList
              items={barberPerformance.map((b) => ({
                label: b.name,
                value: b.completed,
              }))}
              valueSuffix=" concl."
            />
          ) : (
            <EmptyState
              title="Sem dados"
              description="Nenhum atendimento concluído por profissional no período."
            />
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-foreground mb-4">Receita por forma de pagamento</h2>
        <div className="space-y-3">
          {Object.entries(metrics.revenue.byMethod).map(([method, amount]) => {
            const max = Math.max(...Object.values(metrics.revenue.byMethod), 1);
            const pct = (amount / max) * 100;
            return (
              <div key={method}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-400">{PAYMENT_LABELS[method] ?? method}</span>
                  <span className="text-foreground font-medium">{formatCurrency(amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500/70 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(metrics.revenue.byMethod).length === 0 && (
            <EmptyState title="Nenhum pagamento" description="Sem pagamentos no período." />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-foreground mb-4">Agendamentos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBlock label="Total" value={metrics.appointments.total} />
          <StatBlock label="Concluídos" value={metrics.appointments.completed} accent />
          <StatBlock label="Cancelados" value={metrics.appointments.cancelled} />
          <StatBlock label="No-show" value={metrics.appointments.noShow} warn />
        </div>
      </Card>
    </div>
  );
}

function TrendBadge({
  current,
  previous,
  invertTrend,
  hasComparison,
}: {
  current: number;
  previous?: number;
  invertTrend?: boolean;
  hasComparison: boolean;
}) {
  if (!hasComparison || previous === undefined) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-zinc-500">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }

  const diff = current - previous;
  if (Math.abs(diff) < 0.0001) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-zinc-500">
        <Minus className="h-3 w-3" /> Estável
      </span>
    );
  }

  const improved = invertTrend ? diff < 0 : diff > 0;
  const pct =
    previous !== 0
      ? Math.abs((diff / previous) * 100).toFixed(0)
      : "100";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        improved ? "text-green-400" : "text-red-400"
      )}
    >
      {improved ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {pct}% vs anterior
    </span>
  );
}

function MetricCard({
  label,
  value,
  sub,
  current,
  previous,
  hasComparison,
  invertTrend,
}: {
  label: string;
  value: string;
  sub: string;
  current: number;
  previous?: number;
  hasComparison: boolean;
  invertTrend?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
        <TrendBadge
          current={current}
          previous={previous}
          invertTrend={invertTrend}
          hasComparison={hasComparison}
        />
      </div>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{sub}</p>
    </Card>
  );
}

function StatBlock({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="text-center sm:text-left">
      <p
        className={cn(
          "text-2xl font-bold",
          accent && "text-amber-400",
          warn && "text-red-400",
          !accent && !warn && "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function BarList({
  items,
  valueSuffix,
}: {
  items: { label: string; value: number }[];
  valueSuffix?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between gap-2 text-sm mb-1">
            <span className="text-zinc-300 truncate">{item.label}</span>
            <span className="text-zinc-500 shrink-0">
              {item.value}
              {valueSuffix ?? ""}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-600/80 to-amber-400/80"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EvolutionChart({
  data,
}: {
  data: { label: string; cancelled: number; noShow: number }[];
}) {
  const max = Math.max(...data.flatMap((d) => [d.cancelled, d.noShow]), 1);
  const chartHeight = 120;
  const barWidth = Math.min(32, Math.max(12, 280 / data.length - 8));
  const gap = 6;
  const totalWidth = data.length * (barWidth * 2 + gap) + gap;

  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-2">
      <svg
        viewBox={`0 0 ${totalWidth} ${chartHeight + 28}`}
        className="min-w-full"
        style={{ minWidth: totalWidth }}
        role="img"
        aria-label="Gráfico de cancelamentos e no-shows por período"
      >
        {data.map((d, i) => {
          const x = gap + i * (barWidth * 2 + gap);
          const cancelledH = (d.cancelled / max) * chartHeight;
          const noShowH = (d.noShow / max) * chartHeight;
          const baseY = chartHeight;

          return (
            <g key={d.label}>
              <rect
                x={x}
                y={baseY - cancelledH}
                width={barWidth}
                height={cancelledH}
                rx={3}
                className="fill-zinc-500"
              />
              <rect
                x={x + barWidth + 2}
                y={baseY - noShowH}
                width={barWidth}
                height={noShowH}
                rx={3}
                className="fill-red-500/70"
              />
              <text
                x={x + barWidth}
                y={chartHeight + 16}
                textAnchor="middle"
                className="fill-zinc-500 text-[9px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 justify-center mt-2 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-500" />
          Cancelados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/70" />
          No-show
        </span>
      </div>
    </div>
  );
}
