"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  openCashAction,
  closeCashAction,
  addCashMovementAction,
} from "@/lib/finance-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Banknote, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

type CashData = {
  openSession: {
    id: string;
    openingBalance: number;
    openedAt: string;
    operatorName: string;
    locationName: string | null;
  } | null;
  recentSessions: {
    id: string;
    status: string;
    openingBalance: number;
    closingBalance: number | null;
    openedAt: string;
    closedAt: string | null;
    operatorName: string;
  }[];
  movements: {
    id: string;
    type: string;
    amount: number;
    notes: string | null;
    createdAt: string;
  }[];
};

const MOVEMENT_LABELS: Record<string, string> = {
  SUPPLY: "Suprimento",
  BLEED: "Sangria",
  ADJUSTMENT: "Ajuste",
  SALE: "Venda",
  REFUND: "Estorno",
};

export function CaixaPanel({ data }: { data: CashData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openCash(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const balance = Number(fd.get("openingBalance"));
    startTransition(async () => {
      try {
        setError(null);
        await openCashAction(balance, String(fd.get("notes") || ""));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao abrir caixa");
      }
    });
  }

  function closeCash(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data.openSession) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await closeCashAction(
          data.openSession!.id,
          Number(fd.get("closingBalance")),
          String(fd.get("notes") || "")
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao fechar caixa");
      }
    });
  }

  function addMovement(type: "SUPPLY" | "BLEED", e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data.openSession) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await addCashMovementAction(
          data.openSession!.id,
          type,
          Number(fd.get("amount")),
          String(fd.get("notes") || "")
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro na movimentação");
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

      {!data.openSession ? (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-amber-400" />
            Abrir caixa
          </h2>
          <form onSubmit={openCash} className="space-y-4 max-w-md">
            <div>
              <label className="text-sm text-zinc-400">Saldo inicial (R$)</label>
              <Input name="openingBalance" type="number" step="0.01" min="0" required defaultValue="0" />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Observações</label>
              <Input name="notes" placeholder="Opcional" />
            </div>
            <Button type="submit" disabled={pending}>
              Abrir caixa
            </Button>
          </form>
        </Card>
      ) : (
        <>
          <StatCard
            label="Caixa aberto"
            value={formatCurrency(data.openSession.openingBalance)}
            accent
            icon={<Banknote className="h-6 w-6 text-amber-400" />}
          />
          <Card>
            <p className="text-sm text-zinc-400">
              Operador: <span className="text-white">{data.openSession.operatorName}</span>
              {data.openSession.locationName && (
                <> · {data.openSession.locationName}</>
              )}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Aberto em {format(new Date(data.openSession.openedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4 text-green-400" />
                Suprimento
              </h3>
              <form onSubmit={(e) => addMovement("SUPPLY", e)} className="space-y-3">
                <Input name="amount" type="number" step="0.01" min="0.01" placeholder="Valor" required />
                <Input name="notes" placeholder="Observação" />
                <Button type="submit" size="sm" disabled={pending}>Registrar</Button>
              </form>
            </Card>
            <Card>
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-red-400" />
                Sangria
              </h3>
              <form onSubmit={(e) => addMovement("BLEED", e)} className="space-y-3">
                <Input name="amount" type="number" step="0.01" min="0.01" placeholder="Valor" required />
                <Input name="notes" placeholder="Observação" />
                <Button type="submit" size="sm" variant="secondary" disabled={pending}>Registrar</Button>
              </form>
            </Card>
          </div>

          {data.movements.length > 0 && (
            <Card>
              <h3 className="text-sm font-medium text-white mb-3">Movimentações</h3>
              <div className="space-y-2">
                {data.movements.map((m) => (
                  <div key={m.id} className="flex justify-between rounded-lg bg-zinc-900 px-3 py-2 text-sm">
                    <span className="text-zinc-300">{MOVEMENT_LABELS[m.type] ?? m.type}</span>
                    <span className="text-white font-medium">{formatCurrency(m.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="border-amber-500/20">
            <h3 className="text-lg font-semibold text-white mb-4">Fechar caixa</h3>
            <form onSubmit={closeCash} className="space-y-4 max-w-md">
              <div>
                <label className="text-sm text-zinc-400">Saldo contado (R$)</label>
                <Input name="closingBalance" type="number" step="0.01" min="0" required />
              </div>
              <div>
                <label className="text-sm text-zinc-400">Observações</label>
                <Input name="notes" placeholder="Opcional" />
              </div>
              <Button type="submit" disabled={pending} className="bg-amber-500 text-black hover:bg-amber-400">
                Fechar caixa
              </Button>
            </form>
          </Card>
        </>
      )}

      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Histórico recente</h3>
        <div className="space-y-2">
          {data.recentSessions.length === 0 && (
            <p className="text-sm text-zinc-600 text-center py-4">Nenhuma sessão registrada</p>
          )}
          {data.recentSessions.map((s) => (
            <div key={s.id} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className={s.status === "OPEN" ? "text-green-400" : "text-zinc-400"}>
                  {s.status === "OPEN" ? "Aberto" : "Fechado"}
                </span>
                <span className="text-white">{formatCurrency(s.openingBalance)}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {s.operatorName} · {format(new Date(s.openedAt), "dd/MM HH:mm", { locale: ptBR })}
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
