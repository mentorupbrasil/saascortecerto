"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createTenant } from "@/lib/actions";
import { PLAN_LABELS, formatPlanPrice } from "@/lib/plan-pricing";
import { Plus, X } from "lucide-react";

export function TenantFormModal() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createTenant(formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar barbearia");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nova barbearia
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <Card className="w-full max-w-lg my-8 animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Nova barbearia</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input name="name" label="Nome da barbearia" required placeholder="Barbearia Premium" />
              <Input name="slug" label="Slug (URL)" placeholder="barbearia-premium" />
              <Input name="phone" label="Telefone" placeholder="(11) 99999-9999" />
              <Input name="address" label="Endereço" />
              <Select name="plan" label="Plano">
                <option value="FREE">Grátis</option>
                <option value="PRO">{PLAN_LABELS.PRO} — {formatPlanPrice("PRO")} (WhatsApp manual)</option>
                <option value="CLUBE">{PLAN_LABELS.CLUBE} — {formatPlanPrice("CLUBE")} (automático)</option>
              </Select>

              <hr className="border-zinc-800" />
              <p className="text-sm font-medium text-zinc-300">Dono (login inicial)</p>

              <Input name="ownerName" label="Nome do dono" required />
              <Input name="ownerEmail" label="Email do dono" type="email" required />
              <Input name="ownerPassword" label="Senha inicial" type="password" required minLength={6} />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Criando..." : "Criar barbearia"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
