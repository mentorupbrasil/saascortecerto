"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createProductAction,
  adjustStockAction,
} from "@/lib/finance-actions";
import { formatCurrency } from "@/lib/utils";
import { Package, AlertTriangle, Plus } from "lucide-react";

type EstoqueData = {
  products: {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    stockQty: number;
    categoryName: string | null;
    lowStock: boolean;
  }[];
  categories: { id: string; name: string }[];
  lowStockCount: number;
};

export function EstoquePanel({ data }: { data: EstoqueData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function createProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await createProductAction({
          name: String(fd.get("name")),
          sku: String(fd.get("sku") || "") || undefined,
          price: Number(fd.get("price")),
          cost: Number(fd.get("cost") || 0) || undefined,
          categoryId: String(fd.get("categoryId") || "") || undefined,
          initialStock: Number(fd.get("initialStock") || 0) || undefined,
        });
        setShowForm(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar produto");
      }
    });
  }

  function adjustStock(productId: string, delta: number) {
    startTransition(async () => {
      try {
        setError(null);
        await adjustStockAction(productId, Math.abs(delta), delta > 0 ? "Entrada manual" : "Saída manual");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro no ajuste");
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

      {data.lowStockCount > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">{data.lowStockCount} produto(s) com estoque baixo (≤ 5 un.)</p>
          </div>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-400" />
          Produtos ({data.products.length})
        </h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Novo produto
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={createProduct} className="grid gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Nome" required />
            <Input name="sku" placeholder="SKU (opcional)" />
            <Input name="price" type="number" step="0.01" min="0" placeholder="Preço venda" required />
            <Input name="cost" type="number" step="0.01" min="0" placeholder="Custo (opcional)" />
            <Input name="initialStock" type="number" min="0" placeholder="Estoque inicial" defaultValue="0" />
            <select name="categoryId" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white">
              <option value="">Sem categoria</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={pending}>Salvar</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {data.products.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-600 text-center py-6">Nenhum produto cadastrado</p>
          </Card>
        )}
        {data.products.map((p) => (
          <Card key={p.id} className={p.lowStock ? "border-amber-500/30" : undefined}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{p.name}</p>
                <p className="text-sm text-zinc-400">
                  {formatCurrency(p.price)}
                  {p.categoryName && ` · ${p.categoryName}`}
                  {p.sku && ` · SKU ${p.sku}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${p.lowStock ? "text-amber-400" : "text-white"}`}>
                  {p.stockQty} un.
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => adjustStock(p.id, 1)}>+1</Button>
                  <Button size="sm" variant="secondary" disabled={pending || p.stockQty <= 0} onClick={() => adjustStock(p.id, -1)}>-1</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Link href="/financeiro" className="text-sm text-amber-400 hover:text-amber-300">
        ← Voltar ao financeiro
      </Link>
    </div>
  );
}
