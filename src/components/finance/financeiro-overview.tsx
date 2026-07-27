"use client";

import Link from "next/link";
import { Card, StatCard } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet,
  Banknote,
  ShoppingCart,
  Package,
  Percent,
  Receipt,
  TrendingDown,
} from "lucide-react";

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

const quickLinks = [
  { href: "/caixa", label: "Caixa", icon: Banknote, desc: "Abrir/fechar sessão" },
  { href: "/comandas", label: "Comandas", icon: ShoppingCart, desc: "Vendas do dia" },
  { href: "/estoque", label: "Estoque", icon: Package, desc: "Produtos e alertas" },
  { href: "/comissoes", label: "Comissões", icon: Percent, desc: "Regras e lançamentos" },
];

export function FinanceiroOverview({ data }: { data: FinanceOverview }) {
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
          label="Caixa"
          value={data.openCash ? "Aberto" : "Fechado"}
          icon={<Banknote className="h-6 w-6 text-zinc-500" />}
        />
        <StatCard
          label="Comandas abertas"
          value={data.openSalesCount}
          icon={<ShoppingCart className="h-6 w-6 text-zinc-500" />}
        />
      </div>

      {data.openCash && (
        <Card className="border-green-500/20 bg-green-500/5">
          <p className="text-sm text-green-300">
            Caixa aberto — saldo inicial {formatCurrency(data.openCash.openingBalance)}
            {data.openCash.locationName && ` · ${data.openCash.locationName}`}
            {" · "}
            {data.openCash.operatorName}
          </p>
          <Link href="/caixa" className="text-xs text-green-400 hover:text-green-300 mt-2 inline-block">
            Gerenciar caixa →
          </Link>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Operacional</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card hover className="h-full">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-white">{link.label}</p>
                      <p className="text-sm text-zinc-500">{link.desc}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <Card className="border-zinc-700/50">
        <div className="flex items-start gap-3">
          <Receipt className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-zinc-300">Assinatura do sistema</p>
            <p className="text-xs text-zinc-500 mt-1">
              Faturas do CorteCerto (plano SaaS) ficam em Plano e cobrança — separado do financeiro da barbearia.
            </p>
            <Link href="/faturamento" className="text-xs text-amber-400 hover:text-amber-300 mt-2 inline-block">
              Plano e cobrança →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
