"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createAppointment } from "@/lib/actions";
import { X, Plus } from "lucide-react";
import { format } from "date-fns";

type Service = { id: string; name: string; price: string | number | { toString(): string }; duration: number };
type Barber = { id: string; name: string };

export function NewAppointmentModal({
  services,
  barbers,
  defaultDate,
}: {
  services: Service[];
  barbers: Barber[];
  defaultDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  const now = new Date();
  const defaultDateTime = defaultDate
    ? defaultDate
    : format(now, "yyyy-MM-dd'T'HH:mm");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createAppointment(formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar agendamento");
      }
    });
  }

  return (
    <>
      <Button size="lg" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5" />
        Novo horário
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Novo horário</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input name="clientName" label="Nome do cliente" required placeholder="João Silva" />
              <Input
                name="clientPhone"
                label="Telefone"
                required
                placeholder="(11) 99999-9999"
              />

              <Select name="serviceId" label="Serviço" required>
                <option value="">Selecione...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — R$ {Number(s.price).toFixed(2)}
                  </option>
                ))}
              </Select>

              {barbers.length > 0 && (
                <Select name="barberId" label="Barbeiro">
                  <option value="">Qualquer</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              )}

              <Input
                name="scheduledAt"
                label="Data e hora"
                type="datetime-local"
                required
                defaultValue={defaultDateTime}
              />

              <Select name="paymentMethod" label="Forma de pagamento">
                <option value="">A definir</option>
                <option value="PIX">PIX</option>
                <option value="CASH">Dinheiro</option>
                <option value="CARD">Cartão</option>
              </Select>

              <Input name="notes" label="Observações" placeholder="Opcional" />

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? "Salvando..." : "Agendar"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

export function AppointmentActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleStatus(newStatus: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW") {
    startTransition(async () => {
      const { updateAppointmentStatus } = await import("@/lib/actions");
      await updateAppointmentStatus(id, newStatus);
      router.refresh();
    });
  }

  if (status === "COMPLETED" || status === "CANCELLED") return null;

  return (
    <div className="flex gap-1">
      {status === "SCHEDULED" && (
        <button
          disabled={pending}
          onClick={() => handleStatus("CONFIRMED")}
          className="rounded-lg px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10"
          title="Confirmar"
        >
          ✓
        </button>
      )}
      {(status === "SCHEDULED" || status === "CONFIRMED") && (
        <button
          disabled={pending}
          onClick={() => handleStatus("COMPLETED")}
          className="rounded-lg px-2 py-1 text-xs text-green-400 hover:bg-green-500/10"
          title="Concluir"
        >
          ✔
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => handleStatus("CANCELLED")}
        className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
        title="Cancelar"
      >
        ✕
      </button>
    </div>
  );
}
