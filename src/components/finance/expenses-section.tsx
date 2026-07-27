"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        router.refresh();
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao registrar despesa");
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
        router.refresh();
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar categoria");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    startTransition(async () => {
      try {
        await deleteExpenseAction(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao excluir");
      }
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white mb-1">Despesas do mês</h2>
      <p className="text-sm text-amber-400 mb-4">{formatCurrency(data.monthTotal)}</p>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <form onSubmit={addExpense} className="grid gap-2 sm:grid-cols-4 mb-4">
        <select name="categoryId" required className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white">
          <option value="">Categoria</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Input name="amount" type="number" step="0.01" min="0.01" placeholder="Valor" required />
        <Input name="description" placeholder="Descrição" />
        <Button type="submit" size="sm" disabled={pending}>
          <Plus className="h-4 w-4 mr-1" /> Lançar
        </Button>
      </form>

      {data.categories.length === 0 && (
        <form onSubmit={addCategory} className="flex gap-2 mb-4">
          <Input name="name" placeholder="Nova categoria (ex: Aluguel)" required />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>Criar</Button>
        </form>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {data.expenses.length === 0 && (
          <p className="text-sm text-zinc-600 text-center py-4">Nenhuma despesa este mês</p>
        )}
        {data.expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 text-sm">
            <div>
              <p className="text-white">{e.categoryName}</p>
              <p className="text-xs text-zinc-500">
                {e.description ?? "—"} · {format(new Date(e.paidAt), "dd/MM", { locale: ptBR })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400 font-medium">{formatCurrency(e.amount)}</span>
              <button type="button" onClick={() => remove(e.id)} className="text-zinc-600 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
