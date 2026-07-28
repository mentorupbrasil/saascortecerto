"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState, FixedActionBar } from "@/components/ui/page-chrome";
import {
  createCommissionRuleAction,
  updateCommissionRuleAction,
  toggleCommissionRuleAction,
} from "@/lib/finance-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Percent, Plus, Pencil } from "lucide-react";

type CommissionRule = {
  id: string;
  name: string;
  type: string;
  rate: number;
  active: boolean;
  serviceId: string | null;
  serviceName: string | null;
  barberId: string | null;
  barberName: string | null;
};

type ComissoesData = {
  periodKey: string;
  currentPeriodKey: string;
  availablePeriods: string[];
  periodTotal: number;
  rules: CommissionRule[];
  entries: {
    id: string;
    barberName: string;
    itemName: string;
    amount: number;
    periodKey: string;
    ruleName: string | null;
    createdAt: string;
  }[];
  barbers: { id: string; name: string }[];
  services: { id: string; name: string }[];
};

function formatPeriodLabel(periodKey: string) {
  const [year, month] = periodKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return format(date, "MMMM yyyy", { locale: ptBR });
}

function RuleFormFields({
  rule,
  barbers,
  services,
}: {
  rule?: CommissionRule;
  barbers: { id: string; name: string }[];
  services: { id: string; name: string }[];
}) {
  return (
    <>
      <Input name="name" label="Nome da regra" placeholder="Nome da regra" required defaultValue={rule?.name} />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Tipo</label>
        <select
          name="type"
          className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
          defaultValue={rule?.type ?? "PERCENTAGE"}
        >
          <option value="PERCENTAGE">Percentual (%)</option>
          <option value="FIXED">Valor fixo (R$)</option>
        </select>
      </div>
      <Input
        name="rate"
        label="Taxa"
        type="number"
        step="0.01"
        min="0"
        placeholder="Taxa"
        required
        defaultValue={rule?.rate}
      />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Serviço</label>
        <select
          name="serviceId"
          className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
          defaultValue={rule?.serviceId ?? ""}
        >
          <option value="">Todos os serviços</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Profissional</label>
        <select
          name="barberId"
          className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
          defaultValue={rule?.barberId ?? ""}
        >
          <option value="">Todos os barbeiros</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      {!rule && (
        <p className="text-xs text-muted-foreground">
          Alterações em regras não recalculam comissões já lançadas — apenas novas vendas.
        </p>
      )}
    </>
  );
}

export function ComissoesPanel({ data }: { data: ComissoesData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<CommissionRule | null>(null);
  const [toggleTarget, setToggleTarget] = useState<CommissionRule | null>(null);

  const entries = data.entries;

  const summaryByProfessional = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.barberName, (map.get(e.barberName) ?? 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [entries]);

  function changePeriod(next: string) {
    router.push(`/comissoes?period=${next}`);
  }

  function parseRuleForm(fd: FormData) {
    return {
      name: String(fd.get("name")),
      type: fd.get("type") as "PERCENTAGE" | "FIXED",
      rate: Number(fd.get("rate")),
      serviceId: String(fd.get("serviceId") || "") || undefined,
      barberId: String(fd.get("barberId") || "") || undefined,
    };
  }

  function createRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await createCommissionRuleAction(parseRuleForm(fd));
        setCreateOpen(false);
        toast.success("Regra criada");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao criar regra";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function updateRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editRule) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await updateCommissionRuleAction({ ruleId: editRule.id, ...parseRuleForm(fd) });
        setEditRule(null);
        toast.success("Regra atualizada");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao salvar regra";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function runToggle() {
    if (!toggleTarget) return;
    startTransition(async () => {
      try {
        setError(null);
        await toggleCommissionRuleAction(toggleTarget.id, !toggleTarget.active);
        setToggleTarget(null);
        toast.success(toggleTarget.active ? "Regra desativada" : "Regra ativada");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao alterar regra";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Período</label>
          <select
            value={data.periodKey}
            onChange={(e) => changePeriod(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white sm:max-w-xs"
          >
            {data.availablePeriods.map((p) => (
              <option key={p} value={p}>
                {formatPeriodLabel(p)}
                {p === data.currentPeriodKey ? " (atual)" : ""}
              </option>
            ))}
          </select>
        </div>
        <Button className="hidden min-h-[44px] lg:inline-flex" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nova regra
        </Button>
      </div>

      <StatCard
        label={`Comissões — ${formatPeriodLabel(data.periodKey)}`}
        value={formatCurrency(data.periodTotal)}
        accent
        icon={<Percent className="h-6 w-6 text-amber-400" />}
      />

      {summaryByProfessional.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-white">Resumo por profissional</h2>
          <div className="space-y-2">
            {summaryByProfessional.map(({ name, total }) => (
              <div
                key={name}
                className="flex min-h-[44px] items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 text-sm"
              >
                <span className="text-white">{name}</span>
                <span className="font-medium text-amber-400">{formatCurrency(total)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Regras de comissão</h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {data.rules.length === 0 && (
          <div className="sm:col-span-2">
            <EmptyState
              title="Nenhuma regra cadastrada"
              description="Defina percentuais ou valores fixos por serviço ou profissional."
              icon={<Percent className="h-8 w-8" />}
              action={
                <Button className="min-h-[44px]" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Nova regra
                </Button>
              }
            />
          </div>
        )}

        {data.rules.map((r) => (
          <Card key={r.id} className={cn(!r.active && "opacity-60")}>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-white">{r.name}</p>
                  <p className="text-sm text-zinc-400">
                    {r.type === "PERCENTAGE" ? `${r.rate}%` : formatCurrency(r.rate)}
                    {r.serviceName && ` · ${r.serviceName}`}
                    {r.barberName && ` · ${r.barberName}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setToggleTarget(r)}
                  className={cn(
                    "inline-flex min-h-[44px] shrink-0 items-center rounded-full px-3 text-xs font-semibold uppercase tracking-wide",
                    r.active ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/20 text-zinc-400"
                  )}
                >
                  {r.active ? "Ativa" : "Inativa"}
                </button>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px] w-full"
                onClick={() => setEditRule(r)}
              >
                <Pencil className="h-4 w-4" /> Editar regra
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-white">Lançamentos do período</h2>
        <div className="space-y-2">
          {entries.length === 0 && (
            <EmptyState title="Nenhum lançamento neste período" description="Comissões aparecem ao fechar vendas." />
          )}
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg bg-zinc-900 px-3 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-white">{e.barberName}</span>
                <span className="font-medium text-amber-400">{formatCurrency(e.amount)}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {e.itemName}
                {e.ruleName && ` · ${e.ruleName}`}
                {" · "}
                {format(new Date(e.createdAt), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Link href="/financeiro" className="inline-flex min-h-[44px] items-center text-sm text-amber-400 hover:text-amber-300">
        ← Voltar ao financeiro
      </Link>

      <FixedActionBar className="lg:hidden">
        <Button className="w-full min-h-[44px]" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nova regra
        </Button>
      </FixedActionBar>

      <ResponsiveDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nova regra de comissão"
        mobileVariant="sheet"
        footer={
          <Button form="commission-create-form" type="submit" className="w-full min-h-[44px]" disabled={pending}>
            {pending ? "Salvando..." : "Salvar regra"}
          </Button>
        }
      >
        <form id="commission-create-form" onSubmit={createRule} className="space-y-3">
          <RuleFormFields barbers={data.barbers} services={data.services} />
        </form>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={!!editRule}
        onOpenChange={(open) => !open && setEditRule(null)}
        title="Editar regra de comissão"
        mobileVariant="sheet"
        footer={
          <Button form="commission-edit-form" type="submit" className="w-full min-h-[44px]" disabled={pending}>
            {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        }
      >
        {editRule && (
          <form id="commission-edit-form" onSubmit={updateRule} className="space-y-3">
            <RuleFormFields rule={editRule} barbers={data.barbers} services={data.services} />
          </form>
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={toggleTarget?.active ? "Desativar regra?" : "Ativar regra?"}
        description={
          toggleTarget
            ? toggleTarget.active
              ? `"${toggleTarget.name}" deixará de ser aplicada em novas vendas.`
              : `"${toggleTarget.name}" voltará a ser aplicada em novas vendas.`
            : undefined
        }
        confirmLabel={toggleTarget?.active ? "Desativar" : "Ativar"}
        tone={toggleTarget?.active ? "danger" : "default"}
        loading={pending}
        onConfirm={runToggle}
      />
    </div>
  );
}
