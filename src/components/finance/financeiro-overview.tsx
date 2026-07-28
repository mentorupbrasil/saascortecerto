"use client";

import Link from "next/link";
import { Card, StatCard } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Wallet, Banknote, ShoppingCart, TrendingDown, Receipt } from "lucide-react";

type FinanceOverview = {
  todaySales: number;
  monthExpenses: number;
  openCash: {
    id: string;
    openingBalance: number;
    operatorName: string;
    locationName: string | null;
  } | null;
  openSalesCount: number;
};

export function FinanceiroOverview({ data }: { data: FinanceOverview }) {
  const estimatedProfit = data.todaySales - data.monthExpenses;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vendas hoje"
          value={formatCurrency(data.todaySales)}
          accent
          icon={<Wallet className="h-6 w-6 text-amber-400" />}
        />
        <StatCard
          label="Despesas do mês"
          value={formatCurrency(data.monthExpenses)}
          icon={<TrendingDown className="h-6 w-6 text-zinc-500" />}
        />
        <StatCard
          label="Situação do caixa"
          value={data.openCash ? "Aberto" : "Fechado"}
          icon={<Banknote className="h-6 w-6 text-zinc-500" />}
        />
        <StatCard
          label="Comandas abertas"
          value={data.openSalesCount}
          icon={<ShoppingCart className="h-6 w-6 text-zinc-500" />}
        />
      </div>

      <Card>
        <p className="text-sm text-zinc-500">Lucro estimado (vendas hoje − despesas do mês)</p>
        <p
          className={`mt-1 text-2xl font-bold ${
            estimatedProfit >= 0 ? "text-amber-400" : "text-red-400"
          }`}
        >
          {formatCurrency(estimatedProfit)}
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          Indicativo rápido para o dia — não substitui o fechamento contábil.
        </p>
      </Card>

      {data.openCash && (
        <Card className="border-green-500/20 bg-green-500/5">
          <p className="text-sm text-green-300">
            Caixa aberto — saldo inicial {formatCurrency(data.openCash.openingBalance)}
            {data.openCash.locationName && ` · ${data.openCash.locationName}`}
            {" · "}
            {data.openCash.operatorName}
          </p>
          <Link
            href="/caixa"
            className="mt-2 inline-flex min-h-[44px] items-center text-sm text-green-400 hover:text-green-300"
          >
            Gerenciar caixa →
          </Link>
        </Card>
      )}

      <Card className="border-zinc-700/50">
        <div className="flex items-start gap-3">
          <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
          <div>
            <p className="font-medium text-foreground">Plano e cobrança SaaS</p>
            <p className="text-sm text-zinc-500">
              Assinatura da plataforma e faturas ficam em Faturamento.
            </p>
            <Link
              href="/faturamento"
              className="mt-2 inline-flex min-h-[44px] items-center text-sm text-amber-400 hover:text-amber-300"
            >
              Abrir faturamento →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
