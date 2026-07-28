"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { createAppointment } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { maskBrazilianPhone } from "@/lib/client-utils";
import { formatPhone } from "@/lib/utils";
import { format } from "date-fns";

type Service = { id: string; name: string; price: number; duration: number };
type Barber = { id: string; name: string };

export function ClientScheduleModal({
  open,
  onOpenChange,
  clientName,
  clientPhone,
  services,
  barbers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientPhone: string;
  services: Service[];
  barbers: Barber[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [phone, setPhone] = useState(formatPhone(clientPhone));
  const router = useRouter();
  const toast = useToast();

  const defaultDateTime = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("clientPhone", phone.replace(/\D/g, ""));

    startTransition(async () => {
      try {
        await createAppointment(formData);
        toast.success("Agendamento criado");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao agendar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Agendar horário"
      description={clientName}
      mobileVariant="full"
      footer={
        <Button
          type="submit"
          form="client-schedule-form"
          className="w-full min-h-[44px]"
          disabled={pending}
        >
          {pending ? "Agendando..." : "Confirmar agendamento"}
        </Button>
      }
    >
      <form id="client-schedule-form" onSubmit={handleSubmit} className="space-y-4">
        <Input name="clientName" label="Nome" required defaultValue={clientName} />
        <Input
          name="clientPhone"
          label="Telefone"
          required
          value={phone}
          onChange={(e) => setPhone(maskBrazilianPhone(e.target.value))}
          inputMode="tel"
        />

        <Select name="serviceId" label="Serviço" required>
          <option value="">Selecione...</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — R$ {s.price.toFixed(2)}
            </option>
          ))}
        </Select>

        {barbers.length > 0 && (
          <Select name="barberId" label="Profissional">
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
      </form>
    </ResponsiveDialog>
  );
}
