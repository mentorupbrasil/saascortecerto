"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/page-chrome";
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

type SheetKind = "open" | "supply" | "bleed" | "close" | null;

export function CaixaPanel({ data }: { data: CashData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [counted, setCounted] = useState("");

  const totals = useMemo(() => {
    let supply = 0;
    let bleed = 0;
    let sales = 0;
    let refund = 0;
    for (const m of data.movements) {
      if (m.type === "SUPPLY") supply += m.amount;
      if (m.type === "BLEED") bleed += m.amount;
      if (m.type === "SALE") sales += m.amount;
      if (m.type === "REFUND") refund += m.amount;
    }
    const opening = data.openSession?.openingBalance ?? 0;
    const expected = opening + supply + sales - bleed - refund;
    return { supply, bleed, sales, refund, expected };
  }, [data.movements, data.openSession]);

  const diff =
    counted === ""
      ? null
      : Number(counted) - totals.expected;

  function run(action: () => Promise<unknown>, successMsg: string) {
    startTransition(async () => {
      try {
        setError(null);
        await action();
        setSheet(null);
        setCounted("");
        toast.success(successMsg);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro na operação";
        setError(msg);
        toast.error(msg);
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
        <EmptyState
          title="Caixa fechado"
          description="Abra o caixa para registrar vendas em dinheiro, suprimentos e sangrias."
          icon={<Banknote className="h-8 w-8" />}
          action={
            <Button className="min-h-[44px]" onClick={() => setSheet("open")}>
              Abrir caixa
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Saldo inicial"
              value={formatCurrency(data.openSession.openingBalance)}
              accent
              icon={<Banknote className="h-6 w-6 text-amber-400" />}
            />
            <StatCard
              label="Saldo esperado"
              value={formatCurrency(totals.expected)}
              icon={<Banknote className="h-6 w-6 text-zinc-500" />}
            />
          </div>

          <Card>
            <p className="text-sm text-zinc-300">
              Operador: <span className="text-foreground font-medium">{data.openSession.operatorName}</span>
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Aberto em{" "}
              {format(new Date(data.openSession.openedAt), "dd/MM/yyyy HH:mm", {
                locale: ptBR,
              })}
              {data.openSession.locationName ? ` · ${data.openSession.locationName}` : ""}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-zinc-900 px-3 py-2">
                <p className="text-xs text-zinc-500">Vendas dinheiro</p>
                <p className="font-medium text-foreground">{formatCurrency(totals.sales)}</p>
              </div>
              <div className="rounded-lg bg-zinc-900 px-3 py-2">
                <p className="text-xs text-zinc-500">Suprimentos</p>
                <p className="font-medium text-green-400">{formatCurrency(totals.supply)}</p>
              </div>
              <div className="rounded-lg bg-zinc-900 px-3 py-2">
                <p className="text-xs text-zinc-500">Sangrias</p>
                <p className="font-medium text-red-400">{formatCurrency(totals.bleed)}</p>
              </div>
              <div className="rounded-lg bg-zinc-900 px-3 py-2">
                <p className="text-xs text-zinc-500">Estornos</p>
                <p className="font-medium text-orange-300">{formatCurrency(totals.refund)}</p>
              </div>
            </div>
          </Card>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              className="min-h-[44px]"
              variant="secondary"
              onClick={() => setSheet("supply")}
            >
              <ArrowDownCircle className="h-4 w-4" /> Registrar suprimento
            </Button>
            <Button
              className="min-h-[44px]"
              variant="secondary"
              onClick={() => setSheet("bleed")}
            >
              <ArrowUpCircle className="h-4 w-4" /> Registrar sangria
            </Button>
            <Button className="min-h-[44px]" onClick={() => setSheet("close")}>
              Fechar caixa
            </Button>
          </div>

          {data.movements.length > 0 && (
            <Card>
              <h3 className="text-sm font-medium text-foreground mb-3">Movimentações</h3>
              <div className="space-y-2">
                {data.movements.map((m) => (
                  <div
                    key={m.id}
                    className="flex justify-between rounded-lg bg-zinc-900 px-3 py-2.5 text-sm min-h-[44px] items-center"
                  >
                    <span className="text-zinc-300">{MOVEMENT_LABELS[m.type] ?? m.type}</span>
                    <span className="text-foreground font-medium">{formatCurrency(m.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Card>
        <h3 className="text-lg font-semibold text-foreground mb-4">Histórico recente</h3>
        <div className="space-y-2">
          {data.recentSessions.length === 0 && (
            <p className="text-sm text-zinc-600 text-center py-4">Nenhuma sessão registrada</p>
          )}
          {data.recentSessions.map((s) => (
            <div key={s.id} className="rounded-lg bg-zinc-900 px-3 py-2.5 text-sm">
              <div className="flex justify-between">
                <span className={s.status === "OPEN" ? "text-green-400" : "text-zinc-400"}>
                  {s.status === "OPEN" ? "Aberto" : "Fechado"}
                </span>
                <span className="text-foreground">{formatCurrency(s.openingBalance)}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {s.operatorName} ·{" "}
                {format(new Date(s.openedAt), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Link href="/financeiro" className="text-sm text-amber-400 hover:text-amber-300">
        ← Voltar ao financeiro
      </Link>

      <ResponsiveDialog
        open={sheet === "open"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Abrir caixa"
        mobileVariant="sheet"
        footer={
          <Button
            form="cash-open-form"
            type="submit"
            className="w-full min-h-[44px]"
            disabled={pending}
          >
            {pending ? "Abrindo..." : "Confirmar abertura"}
          </Button>
        }
      >
        <form
          id="cash-open-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(
              () =>
                openCashAction(Number(fd.get("openingBalance")), String(fd.get("notes") || "")),
              "Caixa aberto"
            );
          }}
        >
          <Input
            name="openingBalance"
            label="Saldo inicial (R$)"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue="0"
          />
          <Input name="notes" label="Observações" placeholder="Opcional" />
        </form>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={sheet === "supply" || sheet === "bleed"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={sheet === "supply" ? "Registrar suprimento" : "Registrar sangria"}
        mobileVariant="sheet"
        footer={
          <Button
            form="cash-move-form"
            type="submit"
            className="w-full min-h-[44px]"
            disabled={pending}
          >
            {pending ? "Salvando..." : "Confirmar"}
          </Button>
        }
      >
        <form
          id="cash-move-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!data.openSession || (sheet !== "supply" && sheet !== "bleed")) return;
            const fd = new FormData(e.currentTarget);
            const type = sheet === "supply" ? "SUPPLY" : "BLEED";
            run(
              () =>
                addCashMovementAction(
                  data.openSession!.id,
                  type,
                  Number(fd.get("amount")),
                  String(fd.get("notes") || "")
                ),
              type === "SUPPLY" ? "Suprimento registrado" : "Sangria registrada"
            );
          }}
        >
          <Input
            name="amount"
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0.01"
            required
          />
          <Input name="notes" label="Observação" placeholder="Opcional" />
        </form>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={sheet === "close"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Fechar caixa"
        description="Confira o saldo esperado e informe o valor contado."
        mobileVariant="sheet"
        footer={
          <Button
            form="cash-close-form"
            type="submit"
            className="w-full min-h-[44px]"
            disabled={pending}
          >
            {pending ? "Fechando..." : "Confirmar fechamento"}
          </Button>
        }
      >
        <form
          id="cash-close-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!data.openSession) return;
            const fd = new FormData(e.currentTarget);
            run(
              () =>
                closeCashAction(
                  data.openSession!.id,
                  Number(fd.get("closingBalance")),
                  String(fd.get("notes") || "")
                ),
              "Caixa fechado"
            );
          }}
        >
          <div className="rounded-xl bg-zinc-900 px-3 py-3 text-sm">
            <p className="text-zinc-500">Saldo esperado</p>
            <p className="text-lg font-bold text-amber-400">
              {formatCurrency(totals.expected)}
            </p>
          </div>
          <Input
            name="closingBalance"
            label="Saldo contado (R$)"
            type="number"
            step="0.01"
            min="0"
            required
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
          {diff !== null && !Number.isNaN(diff) && (
            <p
              className={
                diff === 0
                  ? "text-sm text-green-400"
                  : diff > 0
                    ? "text-sm text-amber-300"
                    : "text-sm text-red-400"
              }
            >
              Diferença: {formatCurrency(diff)}{" "}
              {diff === 0 ? "(bateu)" : diff > 0 ? "(sobra)" : "(falta)"}
            </p>
          )}
          <Input name="notes" label="Observações" placeholder="Opcional" />
        </form>
      </ResponsiveDialog>
    </div>
  );
}
