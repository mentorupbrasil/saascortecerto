"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, X, Clock, UserX } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  joinWaitlistAction,
  offerWaitlistSlotAction,
  cancelWaitlistEntryAction,
} from "@/lib/waitlist-actions";

type WaitlistEntry = {
  id: string;
  clientName: string;
  clientPhone: string;
  status: string;
  priority: number;
  preferredDates: string | null;
  offerExpiresAt: string | null;
  offeredSlotAt: string | null;
  createdAt: string;
  service: { id: string; name: string; duration: number };
  barber: { id: string; name: string } | null;
};

type FormOptions = {
  services: { id: string; name: string }[];
  barbers: { id: string; name: string }[];
  clients: { id: string; name: string; phone: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  OFFERED: "Oferta enviada",
  BOOKED: "Agendado",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export function WaitlistPanel({
  entries,
  formOptions,
}: {
  entries: WaitlistEntry[];
  formOptions: FormOptions;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await joinWaitlistAction(formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  function handleOffer(entryId: string) {
    const slot = prompt("Horário da vaga (ISO ou datetime-local):");
    if (!slot) return;
    const slotAt = slot.includes("T") && !slot.endsWith("Z")
      ? new Date(slot).toISOString()
      : slot;
    startTransition(async () => {
      try {
        await offerWaitlistSlotAction(entryId, slotAt);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  function handleCancel(entryId: string) {
    if (!confirm("Remover da lista de espera?")) return;
    startTransition(async () => {
      await cancelWaitlistEntryAction(entryId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Adicionar à fila
        </Button>
      </div>

      <div className="grid gap-3">
        {entries.map((entry) => (
          <Card key={entry.id} hover>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-white">{entry.clientName}</p>
                <p className="text-sm text-zinc-400">{formatPhone(entry.clientPhone)}</p>
                <p className="text-sm text-zinc-500 mt-1">
                  {entry.service.name}
                  {entry.barber ? ` · ${entry.barber.name}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
                    {STATUS_LABELS[entry.status] ?? entry.status}
                  </span>
                  {entry.priority > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">
                      Prioridade {entry.priority}
                    </span>
                  )}
                  <span className="text-zinc-600">
                    desde {format(new Date(entry.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                {entry.offeredSlotAt && (
                  <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Vaga oferecida:{" "}
                    {format(new Date(entry.offeredSlotAt), "dd/MM HH:mm", { locale: ptBR })}
                    {entry.offerExpiresAt &&
                      ` (expira ${format(new Date(entry.offerExpiresAt), "dd/MM HH:mm", { locale: ptBR })})`}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {entry.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => handleOffer(entry.id)}
                  >
                    Oferecer vaga
                  </Button>
                )}
                {entry.status !== "CANCELLED" && entry.status !== "BOOKED" && (
                  <button
                    onClick={() => handleCancel(entry.id)}
                    disabled={pending}
                    className="rounded-lg p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                    aria-label="Cancelar"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}

        {entries.length === 0 && (
          <Card>
            <p className="py-8 text-center text-zinc-500">Nenhuma entrada na lista de espera</p>
          </Card>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Lista de espera</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleJoin} className="space-y-4">
              <Input name="clientName" label="Nome" required />
              <Input name="clientPhone" label="Telefone" required />
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Serviço</label>
                <select
                  name="serviceId"
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
                >
                  {formOptions.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Barbeiro (opcional)</label>
                <select
                  name="barberId"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
                >
                  <option value="">Qualquer</option>
                  {formOptions.barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input name="preferredDates" label="Datas preferidas (YYYY-MM-DD, separadas por vírgula)" />
              <Input name="priority" label="Prioridade" type="number" min={0} defaultValue={0} />
              <Textarea name="notes" label="Observações" />
              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
              )}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? "Salvando..." : "Adicionar"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
