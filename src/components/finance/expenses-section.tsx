"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/page-chrome";
import {
  createExpenseAction,
  createExpenseCategoryAction,
  deleteExpenseAction,
} from "@/lib/finance-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";

type ExpensesData = {
  expenses: {
    id: string;
    categoryName: string;
    amount: number;
    description: string | null;
    paidAt: string;
  }[];
  categories: { id: string; name: string }[];
  monthTotal: number;
};

export function ExpensesSection({ data }: { data: ExpensesData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await createExpenseAction({
          categoryId: String(fd.get("categoryId")),
          amount: Number(fd.get("amount")),
          description: String(fd.get("description") || "") || undefined,
        });
        setOpen(false);
        toast.success("Despesa registrada");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao registrar despesa";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function addCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setError(null);
        await createExpenseCategoryAction(String(fd.get("name")));
        toast.success("Categoria criada");
        router.refresh();
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao criar categoria";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Despesas do mês</h2>
          <p className="text-sm text-amber-400">{formatCurrency(data.monthTotal)}</p>
        </div>
        <Button className="min-h-[44px]" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Registrar despesa
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {data.categories.length === 0 && (
        <form onSubmit={addCategory} className="mb-4 flex gap-2">
          <Input name="name" placeholder="Nova categoria (ex: Aluguel)" required />
          <Button type="submit" size="sm" variant="secondary" disabled={pending} className="min-h-[44px]">
            Criar
          </Button>
        </form>
      )}

      <div className="space-y-2">
        {data.expenses.length === 0 && (
          <EmptyState title="Nenhuma despesa este mês" description="Registre aluguel, insumos e outras saídas." />
        )}
        {data.expenses.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900 px-3 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate text-white">{e.categoryName}</p>
              <p className="text-xs text-zinc-500">
                {e.description ?? "—"} ·{" "}
                {format(new Date(e.paidAt), "dd/MM", { locale: ptBR })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{formatCurrency(e.amount)}</span>
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                aria-label="Excluir despesa"
                onClick={() => setDeleteId(e.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Registrar despesa"
        mobileVariant="sheet"
        footer={
          <Button form="expense-form" type="submit" className="w-full min-h-[44px]" disabled={pending}>
            {pending ? "Salvando..." : "Salvar despesa"}
          </Button>
        }
      >
        <form id="expense-form" onSubmit={addExpense} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Categoria
            </label>
            <select
              name="categoryId"
              required
              className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground min-h-[44px]"
            >
              <option value="">Selecione...</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Input name="amount" type="number" step="0.01" min="0.01" label="Valor" required />
          <Input name="description" label="Descrição" placeholder="Opcional" />
        </form>
      </ResponsiveDialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir despesa?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        tone="danger"
        loading={pending}
        onConfirm={async () => {
          if (!deleteId) return;
          await deleteExpenseAction(deleteId);
          toast.success("Despesa excluída");
          router.refresh();
        }}
      />
    </Card>
  );
}
