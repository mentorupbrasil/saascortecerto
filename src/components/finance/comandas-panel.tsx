"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createComandaAction,
  addComandaItemAction,
  addComandaPaymentAction,
  cancelComandaAction,
} from "@/lib/finance-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ShoppingCart, Plus, X } from "lucide-react";
import type { SaleStatus } from "@prisma/client";

type ComandasData = {
  sales: {
    id: string;
    status: SaleStatus;
    clientName: string | null;
    operatorName: string;
    total: number;
    itemCount: number;
    createdAt: string;
  }[];
  services: { id: string; name: string; price: number }[];
  clients: { id: string; name: string }[];
  barbers: { id: string; name: string }[];
  openCashSessionId: string | null;
};

const STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberta",
  CLOSED: "Fechada",
  CANCELLED: "Cancelada",
};

const STATUS_COLORS: Record<SaleStatus, string> = {
  DRAFT: "bg-zinc-500/20 text-zinc-400",
  OPEN: "bg-amber-500/20 text-amber-400",
  CLOSED: "bg-green-500/20 text-green-400",
  CANCELLED: "bg-red-500/20 text-red-400",
};

export function ComandasPanel({ data }: { data: ComandasData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function newComanda(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        const clientId = String(fd.get("clientId") || "") || undefined;
        await createComandaAction({ clientId });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar comanda");
      }
    });
  }

  function addItem(saleId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await addComandaItemAction(saleId, {
          kind: "SERVICE",
          serviceId: String(fd.get("serviceId")),
          barberId: String(fd.get("barberId") || "") || undefined,
          quantity: Number(fd.get("quantity") || 1),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao adicionar item");
      }
    });
  }

  function addPayment(saleId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await addComandaPaymentAction(
          saleId,
          fd.get("method") as "PIX" | "CASH" | "CARD",
          Number(fd.get("amount"))
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao registrar pagamento");
      }
    });
  }

  function cancel(saleId: string) {
    if (!confirm("Cancelar esta comanda?")) return;
    startTransition(async () => {
      try {
        setError(null);
        await cancelComandaAction(saleId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao cancelar");
      }
    });
  }

  const openSales = data.sales.filter((s) => s.status === "OPEN" || s.status === "DRAFT");

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-amber-400" />
          Nova comanda
        </h2>
        <form onSubmit={newComanda} className="flex flex-col sm:flex-row gap-3">
          <select
            name="clientId"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Cliente avulso</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button type="submit" disabled={pending}>Abrir comanda</Button>
        </form>
        {!data.openCashSessionId && (
          <p className="text-xs text-amber-400/80 mt-3">
            Caixa fechado — pagamentos em dinheiro não serão lançados no caixa até abrir sessão.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-amber-400" />
          Comandas ({data.sales.length})
        </h2>
        <div className="space-y-3">
          {data.sales.length === 0 && (
            <p className="text-sm text-zinc-600 text-center py-6">Nenhuma comanda ainda</p>
          )}
          {data.sales.map((sale) => (
            <div key={sale.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-900 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {sale.clientName ?? "Avulso"} · {formatCurrency(sale.total)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {sale.itemCount} item(ns) · {format(new Date(sale.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[sale.status]}`}>
                  {STATUS_LABELS[sale.status]}
                </span>
              </button>

              {expandedId === sale.id && (sale.status === "OPEN" || sale.status === "DRAFT") && (
                <div className="border-t border-zinc-800 p-4 space-y-4">
                  <form onSubmit={(e) => addItem(sale.id, e)} className="grid gap-2 sm:grid-cols-4">
                    <select name="serviceId" required className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-white sm:col-span-2">
                      <option value="">Serviço</option>
                      {data.services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} — {formatCurrency(s.price)}</option>
                      ))}
                    </select>
                    <select name="barberId" className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-white">
                      <option value="">Barbeiro</option>
                      {data.barbers.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" disabled={pending}>+ Item</Button>
                  </form>

                  <form onSubmit={(e) => addPayment(sale.id, e)} className="flex flex-wrap gap-2 items-end">
                    <select name="method" className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-white">
                      <option value="PIX">PIX</option>
                      <option value="CASH">Dinheiro</option>
                      <option value="CARD">Cartão</option>
                    </select>
                    <Input name="amount" type="number" step="0.01" min="0.01" placeholder="Valor" className="w-28" required />
                    <Button type="submit" size="sm" disabled={pending}>Pagar</Button>
                  </form>

                  <button
                    type="button"
                    onClick={() => cancel(sale.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    <X className="h-3 w-3" /> Cancelar comanda
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {openSales.length > 0 && (
        <p className="text-sm text-zinc-500">{openSales.length} comanda(s) aberta(s)</p>
      )}

      <Link href="/financeiro" className="text-sm text-amber-400 hover:text-amber-300">
        ← Voltar ao financeiro
      </Link>
    </div>
  );
}
