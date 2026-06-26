"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createService, toggleService } from "@/lib/actions";
import { Plus, X } from "lucide-react";

export function ServiceFormModal() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createService(formData);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo serviço
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Novo serviço</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input name="name" label="Nome" required placeholder="Corte" />
              <Input name="price" label="Valor (R$)" type="number" step="0.01" required />
              <Input name="duration" label="Duração (min)" type="number" defaultValue={30} required />
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

export function ToggleServiceButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleService(id, !active);
          router.refresh();
        })
      }
      className={`rounded-lg px-3 py-1 text-xs font-medium ${
        active
          ? "bg-green-500/20 text-green-400"
          : "bg-zinc-700 text-zinc-400"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
    </button>
  );
}
