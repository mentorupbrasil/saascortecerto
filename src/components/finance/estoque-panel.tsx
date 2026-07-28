"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState, FixedActionBar } from "@/components/ui/page-chrome";
import {
  createProductAction,
  adjustStockAction,
} from "@/lib/finance-actions";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Package, AlertTriangle, Plus, Search, SlidersHorizontal, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

type EstoqueData = {
  products: {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    stockQty: number;
    categoryName: string | null;
    categoryId: string | null;
    lowStock: boolean;
  }[];
  categories: { id: string; name: string }[];
  lowStockCount: number;
};

type AdjustTarget = {
  id: string;
  name: string;
  stockQty: number;
};

export function EstoquePanel({ data }: { data: EstoqueData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<AdjustTarget | null>(null);
  const [adjustType, setAdjustType] = useState<"IN" | "OUT">("IN");
  const [adjustQty, setAdjustQty] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");
  const [confirmAdjust, setConfirmAdjust] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.products.filter((p) => {
      if (lowStockOnly && !p.lowStock) return false;
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false) ||
        (p.categoryName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data.products, search, lowStockOnly, categoryFilter]);

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
        setCreateOpen(false);
        toast.success("Produto cadastrado");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao criar produto";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function openAdjust(product: AdjustTarget) {
    setAdjustTarget(product);
    setAdjustType("IN");
    setAdjustQty("1");
    setAdjustReason("");
    setConfirmAdjust(false);
  }

  function requestAdjustConfirm() {
    const qty = Number(adjustQty);
    if (!adjustTarget || !Number.isFinite(qty) || qty <= 0) {
      toast.error("Informe uma quantidade válida");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Informe o motivo do ajuste");
      return;
    }
    if (adjustType === "OUT" && qty > adjustTarget.stockQty) {
      toast.error("Quantidade maior que o estoque atual");
      return;
    }
    setConfirmAdjust(true);
  }

  function runAdjust() {
    if (!adjustTarget) return;
    const qty = Number(adjustQty);
    const signed = adjustType === "IN" ? qty : -qty;
    startTransition(async () => {
      try {
        setError(null);
        await adjustStockAction(adjustTarget.id, signed, adjustReason.trim());
        setAdjustTarget(null);
        setConfirmAdjust(false);
        toast.success(adjustType === "IN" ? "Entrada registrada" : "Saída registrada");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro no ajuste";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      {data.lowStockCount > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{data.lowStockCount} produto(s) com estoque baixo (≤ 5 un.)</p>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Package className="h-5 w-5 text-amber-400" />
          Produtos ({filtered.length})
        </h2>
        <Button className="hidden min-h-[44px] lg:inline-flex" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, SKU ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-[44px] pl-10"
          aria-label="Buscar produtos"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLowStockOnly((v) => !v)}
          className={cn(
            "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors",
            lowStockOnly
              ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
              : "border-border bg-card text-muted-foreground hover:bg-accent"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Estoque baixo
        </button>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="min-h-[44px] rounded-full border border-border bg-card px-3 text-sm text-foreground"
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas categorias</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <EmptyState
            title={search || lowStockOnly || categoryFilter ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
            description={
              search || lowStockOnly || categoryFilter
                ? "Tente outro termo ou remova os filtros."
                : "Cadastre produtos para controlar entradas e saídas."
            }
            icon={<Package className="h-8 w-8" />}
            action={
              <Button className="min-h-[44px]" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Novo produto
              </Button>
            }
          />
        )}

        {filtered.map((p) => (
          <Card key={p.id} className={p.lowStock ? "border-amber-500/30" : undefined}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="text-sm text-zinc-400">
                  {formatCurrency(p.price)}
                  {p.categoryName && ` · ${p.categoryName}`}
                  {p.sku && ` · SKU ${p.sku}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-lg font-bold",
                    p.lowStock ? "text-amber-400" : "text-foreground"
                  )}
                >
                  {p.stockQty} un.
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-[44px] px-3"
                  disabled={pending}
                  onClick={() => openAdjust({ id: p.id, name: p.name, stockQty: p.stockQty })}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Ajustar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Link href="/financeiro" className="inline-flex min-h-[44px] items-center text-sm text-amber-400 hover:text-amber-300">
        ← Voltar ao financeiro
      </Link>

      <FixedActionBar className="lg:hidden">
        <Button className="w-full min-h-[44px]" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      </FixedActionBar>

      <ResponsiveDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Novo produto"
        mobileVariant="sheet"
        footer={
          <Button form="product-create-form" type="submit" className="w-full min-h-[44px]" disabled={pending}>
            {pending ? "Salvando..." : "Salvar produto"}
          </Button>
        }
      >
        <form id="product-create-form" onSubmit={createProduct} className="grid gap-3">
          <Input name="name" label="Nome" placeholder="Nome" required />
          <Input name="sku" label="SKU" placeholder="SKU (opcional)" />
          <Input name="price" label="Preço venda" type="number" step="0.01" min="0" required />
          <Input name="cost" label="Custo" type="number" step="0.01" min="0" placeholder="Custo (opcional)" />
          <Input name="initialStock" label="Estoque inicial" type="number" min="0" defaultValue="0" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Categoria</label>
            <select
              name="categoryId"
              className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-foreground"
            >
              <option value="">Sem categoria</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={!!adjustTarget}
        onOpenChange={(open) => !open && setAdjustTarget(null)}
        title={adjustTarget ? `Ajustar — ${adjustTarget.name}` : "Ajustar estoque"}
        description={adjustTarget ? `Estoque atual: ${adjustTarget.stockQty} un.` : undefined}
        mobileVariant="sheet"
        footer={
          <Button
            type="button"
            className="w-full min-h-[44px]"
            disabled={pending}
            onClick={requestAdjustConfirm}
          >
            Confirmar ajuste
          </Button>
        }
      >
        {adjustTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustType("IN")}
                className={cn(
                  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium",
                  adjustType === "IN"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setAdjustType("OUT")}
                className={cn(
                  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium",
                  adjustType === "OUT"
                    ? "border-red-500/50 bg-red-500/10 text-red-300"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                <ArrowUpFromLine className="h-4 w-4" />
                Saída
              </button>
            </div>
            <Input
              label="Quantidade"
              type="number"
              min="1"
              step="1"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              required
            />
            <Input
              label="Motivo (obrigatório)"
              placeholder="Ex.: compra fornecedor, perda, uso interno..."
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              required
            />
          </div>
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirmAdjust}
        onOpenChange={setConfirmAdjust}
        title={adjustType === "IN" ? "Confirmar entrada?" : "Confirmar saída?"}
        description={
          adjustTarget
            ? `${adjustType === "IN" ? "Entrada" : "Saída"} de ${adjustQty} un. — ${adjustReason.trim()}`
            : undefined
        }
        confirmLabel="Confirmar"
        loading={pending}
        onConfirm={runAdjust}
      />
    </div>
  );
}
