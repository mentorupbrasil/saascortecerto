"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createCommissionRuleAction } from "@/lib/finance-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Percent, Plus } from "lucide-react";

type ComissoesData = {
  periodKey: string;
  periodTotal: number;
  rules: {
    id: string;
    name: string;
    type: string;
    rate: number;
    active: boolean;
    serviceName: string | null;
    barberName: string | null;
  }[];
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

export function ComissoesPanel({ data }: { data: ComissoesData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function createRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await createCommissionRuleAction({
          name: String(fd.get("name")),
          type: fd.get("type") as "PERCENTAGE" | "FIXED",
          rate: Number(fd.get("rate")),
          serviceId: String(fd.get("serviceId") || "") || undefined,
          barberId: String(fd.get("barberId") || "") || undefined,
        });
        setShowForm(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar regra");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <StatCard
        label={`Comissões — ${data.periodKey}`}
        value={formatCurrency(data.periodTotal)}
        accent
        icon={<Percent className="h-6 w-6 text-amber-400" />}
      />

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Regras de comissão</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Nova regra
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={createRule} className="grid gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Nome da regra" required />
            <select name="type" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" defaultValue="PERCENTAGE">
              <option value="PERCENTAGE">Percentual (%)</option>
              <option value="FIXED">Valor fixo (R$)</option>
            </select>
            <Input name="rate" type="number" step="0.01" min="0" placeholder="Taxa" required />
            <select name="serviceId" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white">
              <option value="">Todos os serviços</option>
              {data.services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select name="barberId" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white">
              <option value="">Todos os barbeiros</option>
              {data.barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={pending}>Salvar</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </form>
          <p className="text-xs text-zinc-500 mt-3">
            Alterações em regras não recalculam comissões já lançadas — apenas novas vendas.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {data.rules.length === 0 && (
          <Card><p className="text-sm text-zinc-600 text-center py-4">Nenhuma regra cadastrada</p></Card>
        )}
        {data.rules.map((r) => (
          <Card key={r.id}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-white">{r.name}</p>
                <p className="text-sm text-zinc-400">
                  {r.type === "PERCENTAGE" ? `${r.rate}%` : formatCurrency(r.rate)}
                  {r.serviceName && ` · ${r.serviceName}`}
                  {r.barberName && ` · ${r.barberName}`}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${r.active ? "bg-green-500/20 text-green-400" : "bg-zinc-500/20 text-zinc-400"}`}>
                {r.active ? "Ativa" : "Inativa"}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Lançamentos do período</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {data.entries.length === 0 && (
            <p className="text-sm text-zinc-600 text-center py-4">Nenhum lançamento neste mês</p>
          )}
          {data.entries.map((e) => (
            <div key={e.id} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white">{e.barberName}</span>
                <span className="text-amber-400 font-medium">{formatCurrency(e.amount)}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {e.itemName}
                {e.ruleName && ` · ${e.ruleName}`}
                {" · "}
                {format(new Date(e.createdAt), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Link href="/financeiro" className="text-sm text-amber-400 hover:text-amber-300">
        ← Voltar ao financeiro
      </Link>
    </div>
  );
}
