"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  createPublicBooking,
  getPublicAvailableSlots,
} from "@/lib/public-booking-actions";
import { formatSlotLabel } from "@/lib/booking-slots";
import { formatCurrency } from "@/lib/utils";
import { format, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Logo } from "@/components/brand/logo";
import { Calendar, CheckCircle2, ExternalLink, Scissors } from "lucide-react";

type PublicBookingData = {
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  openTime: string;
  closeTime: string;
  requirePixPayment?: boolean;
  pixPaymentReady?: boolean;
  services: Array<{ id: string; name: string; price: number; duration: number }>;
  barbers: Array<{ id: string; name: string }>;
};

export function PublicBookingForm({ tenant }: { tenant: PublicBookingData }) {
  const router = useRouter();  const [serviceId, setServiceId] = useState(tenant.services[0]?.id ?? "");
  const [barberId, setBarberId] = useState("");
  const [dateStr, setDateStr] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    scheduledAt: string;
    serviceName: string;
    clientWaUrl: string;
  } | null>(null);

  const selectedService = tenant.services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (!serviceId || !dateStr) return;
    setLoadingSlots(true);
    setSlot("");
    getPublicAvailableSlots(tenant.slug, dateStr, serviceId, barberId || undefined)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [tenant.slug, dateStr, serviceId, barberId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!slot) {
      setError("Escolha um horário");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("scheduledAt", slot);
    formData.set("serviceId", serviceId);
    if (barberId) formData.set("barberId", barberId);

    startTransition(async () => {
      try {
        const result = await createPublicBooking(tenant.slug, formData);
        if ("requiresPayment" in result && result.requiresPayment && result.checkoutId) {
          router.push(`/agendar/${tenant.slug}/pagamento/${result.checkoutId}`);
          return;
        }
        if (!result.clientWaUrl) return;
        setSuccess({
          scheduledAt: result.scheduledAt!,
          serviceName: result.serviceName!,
          clientWaUrl: result.clientWaUrl,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao agendar");
      }
    });  }

  if (success) {
    const when = format(new Date(success.scheduledAt), "EEEE, dd/MM 'às' HH:mm", {
      locale: ptBR,
    });

    return (
      <Card className="text-center max-w-md mx-auto">
        <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Horário reservado!</h2>
        <p className="text-zinc-400 mb-1">{success.serviceName}</p>
        <p className="text-amber-400 font-medium capitalize mb-6">{when}</p>
        <p className="text-sm text-zinc-500 mb-4">
          A barbearia foi avisada do seu agendamento.
        </p>
        <a
          href={success.clientWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-green-400 hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Confirmar no WhatsApp
        </a>
      </Card>
    );
  }

  const minDate = format(startOfDay(new Date()), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

  return (
    <Card>
      {tenant.requirePixPayment && (
        <p className="text-sm text-amber-400/90 mb-4 rounded-lg bg-amber-500/10 px-3 py-2">
          Pagamento via PIX é necessário para confirmar o horário.
        </p>
      )}
      {!tenant.pixPaymentReady && tenant.requirePixPayment && (
        <p className="text-sm text-red-400 mb-4">
          Agendamento com PIX temporariamente indisponível. Entre em contato com a barbearia.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">        <Select
          name="serviceId"
          label="Serviço"
          required
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        >
          {tenant.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatCurrency(s.price)} ({s.duration} min)
            </option>
          ))}
        </Select>

        {tenant.barbers.length > 0 && (
          <Select
            name="barberId"
            label="Profissional (opcional)"
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
          >
            <option value="">Qualquer disponível</option>
            {tenant.barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}

        <Input
          name="date"
          label="Data"
          type="date"
          required
          min={minDate}
          max={maxDate}
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Horário disponível
          </label>
          {loadingSlots ? (
            <p className="text-sm text-zinc-500">Carregando horários...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-zinc-500 rounded-lg bg-zinc-900 p-3">
              Nenhum horário livre nesta data. Tente outro dia.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 sm:max-h-40 overflow-y-auto touch-scroll">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={`rounded-lg px-2 py-3 sm:py-2 text-sm font-medium transition-colors min-h-[44px] ${
                    slot === s
                      ? "bg-amber-500 text-black"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {formatSlotLabel(s)}
                </button>
              ))}
            </div>
          )}
        </div>

        <hr className="border-zinc-800" />

        <Input name="clientName" label="Seu nome" required placeholder="Como te chamam?" />
        <Input
          name="clientPhone"
          label="Seu WhatsApp / telefone"
          required
          placeholder="(11) 99999-9999"
        />

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={pending || !slot || (tenant.requirePixPayment && !tenant.pixPaymentReady)}
        >
          {pending
            ? "Processando..."
            : tenant.requirePixPayment
              ? "Continuar para pagamento PIX"
              : "Confirmar agendamento"}
        </Button>      </form>
    </Card>
  );
}

export function PublicBookingHeader({ tenant }: { tenant: PublicBookingData }) {
  return (
    <div className="text-center mb-8">
      <Logo variant="compact" href={null} className="mx-auto h-10 mb-4" />
      <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
      <p className="text-zinc-400 mt-1 flex items-center justify-center gap-2 text-sm">
        <Calendar className="h-4 w-4" />
        Agende seu horário online
      </p>
      {tenant.address && (
        <p className="text-xs text-zinc-600 mt-2">{tenant.address}</p>
      )}
      <p className="text-xs text-zinc-600 mt-1">
        <Scissors className="h-3 w-3 inline mr-1" />
        {tenant.openTime} às {tenant.closeTime}
      </p>
    </div>
  );
}
