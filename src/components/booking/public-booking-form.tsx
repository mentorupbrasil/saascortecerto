"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  createPublicBooking,
  getPublicAvailableSlots,
} from "@/lib/public-booking-actions";
import { formatSlotLabel } from "@/lib/booking-slots";
import { formatCurrency } from "@/lib/utils";
import { maskBrazilianPhone } from "@/lib/client-utils";
import { format, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  ExternalLink,
  Scissors,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

type StepId = "service" | "pro" | "day" | "time" | "client" | "review" | "payment";

const STEP_LABELS: Record<StepId, string> = {
  service: "Serviço",
  pro: "Profissional",
  day: "Dia",
  time: "Horário",
  client: "Seus dados",
  review: "Revisão",
  payment: "Pagamento",
};

function buildSteps(tenant: PublicBookingData): StepId[] {
  const steps: StepId[] = ["service"];
  if (tenant.barbers.length > 0) steps.push("pro");
  steps.push("day", "time", "client", "review");
  if (tenant.requirePixPayment) steps.push("payment");
  return steps;
}

export function PublicBookingForm({ tenant }: { tenant: PublicBookingData }) {
  const router = useRouter();
  const steps = useMemo(() => buildSteps(tenant), [tenant]);

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];

  const [serviceId, setServiceId] = useState(tenant.services[0]?.id ?? "");
  const [barberId, setBarberId] = useState("");
  const [dateStr, setDateStr] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    scheduledAt: string;
    serviceName: string;
    clientWaUrl: string;
  } | null>(null);

  const selectedService = tenant.services.find((s) => s.id === serviceId);
  const selectedBarber = tenant.barbers.find((b) => b.id === barberId);
  const dayOptions = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i)),
    []
  );

  useEffect(() => {
    if (!serviceId || !dateStr) return;
    setLoadingSlots(true);
    setSlot("");
    getPublicAvailableSlots(tenant.slug, dateStr, serviceId, barberId || undefined)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [tenant.slug, dateStr, serviceId, barberId]);

  function clearError() {
    if (error) setError("");
  }

  function validateStep(step: StepId): string | null {
    if (step === "service" && !serviceId) return "Escolha um serviço";
    if (step === "time" && !slot) return "Escolha um horário";
    if (step === "client") {
      if (!clientName.trim()) return "Informe seu nome";
      const digits = clientPhone.replace(/\D/g, "");
      if (digits.length < 10) return "Informe um telefone válido";
    }
    return null;
  }

  function goNext() {
    clearError();
    const msg = validateStep(currentStep);
    if (msg) {
      setError(msg);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goBack() {
    clearError();
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handleConfirm() {
    clearError();
    if (!slot) {
      setError("Escolha um horário");
      return;
    }

    const formData = new FormData();
    formData.set("scheduledAt", slot);
    formData.set("serviceId", serviceId);
    formData.set("clientName", clientName.trim());
    formData.set("clientPhone", clientPhone.replace(/\D/g, ""));
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
    });
  }

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
        <p className="text-sm text-zinc-500 mb-4">A barbearia foi avisada do seu agendamento.</p>
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

  const pixBlocked = tenant.requirePixPayment && !tenant.pixPaymentReady;
  const isLastStep = stepIndex === steps.length - 1;
  const whenLabel = slot
    ? format(new Date(slot), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })
    : null;

  return (
    <div className="flex flex-col pb-28">
      {tenant.requirePixPayment && (
        <p className="text-sm text-amber-400/90 mb-4 rounded-lg bg-amber-500/10 px-3 py-2">
          Pagamento via PIX é necessário para confirmar o horário.
        </p>
      )}
      {pixBlocked && (
        <p className="text-sm text-red-400 mb-4">
          Agendamento com PIX temporariamente indisponível. Entre em contato com a barbearia.
        </p>
      )}

      <div className="mb-4">
        <p className="text-xs text-zinc-500 mb-2">
          Passo {stepIndex + 1} de {steps.length} · {STEP_LABELS[currentStep]}
        </p>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= stepIndex ? "bg-amber-500" : "bg-zinc-800"
              )}
              aria-hidden
            />
          ))}
        </div>
      </div>

      <Card>
        {currentStep === "service" && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400 mb-2">Escolha o serviço desejado.</p>
            <div className="grid gap-2">
              {tenant.services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setServiceId(s.id);
                    clearError();
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors min-h-[72px]",
                    serviceId === s.id
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{s.name}</p>
                      <p className="text-sm text-amber-400 mt-0.5">{formatCurrency(s.price)}</p>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {s.duration} min
                      </p>
                    </div>
                    {serviceId === s.id && <Check className="h-5 w-5 text-amber-400 shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === "pro" && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400 mb-2">Com quem prefere ser atendido?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setBarberId("");
                  clearError();
                }}
                className={cn(
                  "rounded-full px-4 py-2.5 text-sm font-medium min-h-[44px] transition-colors",
                  !barberId
                    ? "bg-amber-500 text-black"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                )}
              >
                Qualquer disponível
              </button>
              {tenant.barbers.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBarberId(b.id);
                    clearError();
                  }}
                  className={cn(
                    "rounded-full px-4 py-2.5 text-sm font-medium min-h-[44px] transition-colors inline-flex items-center gap-1.5",
                    barberId === b.id
                      ? "bg-amber-500 text-black"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === "day" && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400 mb-2">Escolha o dia.</p>
            <div className="flex gap-2 overflow-x-auto pb-2 touch-scroll -mx-1 px-1">
              {dayOptions.map((day) => {
                const value = format(day, "yyyy-MM-dd");
                const selected = dateStr === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setDateStr(value);
                      clearError();
                    }}
                    className={cn(
                      "shrink-0 rounded-xl border px-3 py-3 min-w-[4.5rem] min-h-[64px] text-center transition-colors",
                      selected
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                    )}
                  >
                    <p className="text-[10px] uppercase text-zinc-500">
                      {format(day, "EEE", { locale: ptBR })}
                    </p>
                    <p className={cn("text-lg font-semibold", selected ? "text-amber-400" : "text-white")}>
                      {format(day, "dd")}
                    </p>
                    <p className="text-[10px] text-zinc-500">{format(day, "MMM", { locale: ptBR })}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === "time" && (
          <div>
            <p className="text-sm text-zinc-400 mb-3">
              Horários para{" "}
              <span className="text-zinc-300 capitalize">
                {format(new Date(dateStr + "T12:00:00"), "EEEE, dd/MM", { locale: ptBR })}
              </span>
            </p>
            {loadingSlots ? (
              <p className="text-sm text-zinc-500">Carregando horários...</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-zinc-500 rounded-lg bg-zinc-900 p-3">
                Nenhum horário livre nesta data. Volte e escolha outro dia.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto touch-scroll">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSlot(s);
                      clearError();
                    }}
                    className={cn(
                      "rounded-lg px-2 py-3 text-sm font-medium transition-colors min-h-[44px]",
                      slot === s
                        ? "bg-amber-500 text-black"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    )}
                  >
                    {formatSlotLabel(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {currentStep === "client" && (
          <div className="space-y-4">
            <Input
              label="Seu nome"
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                clearError();
              }}
              required
              placeholder="Como te chamam?"
              autoFocus
            />
            <Input
              label="Seu WhatsApp / telefone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(maskBrazilianPhone(e.target.value))}
              required
              placeholder="(11) 99999-9999"
            />
          </div>
        )}

        {currentStep === "review" && (
          <div className="space-y-3 text-sm">
            <p className="text-zinc-400 mb-2">Confira antes de confirmar.</p>
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-2.5">
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Serviço</span>
                <span className="text-white text-right">{selectedService?.name}</span>
              </div>
              {selectedService && (
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Valor</span>
                  <span className="text-amber-400">{formatCurrency(selectedService.price)}</span>
                </div>
              )}
              {tenant.barbers.length > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Profissional</span>
                  <span className="text-white text-right">
                    {selectedBarber?.name ?? "Qualquer disponível"}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Quando</span>
                <span className="text-white text-right capitalize">{whenLabel}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Nome</span>
                <span className="text-white text-right">{clientName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Telefone</span>
                <span className="text-white">{clientPhone}</span>
              </div>
            </div>
          </div>
        )}

        {currentStep === "payment" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
              <p className="text-sm font-medium text-amber-300">Pagamento PIX necessário</p>
              <p className="text-sm text-zinc-400 mt-2">
                Ao confirmar, você será direcionado para pagar via PIX e garantir seu horário.
              </p>
            </div>
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Total</span>
                <span className="text-xl font-bold text-amber-400">
                  {selectedService ? formatCurrency(selectedService.price) : "—"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 capitalize">{whenLabel}</p>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 mt-4">{error}</p>
        )}
      </Card>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg gap-2">
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="min-h-[48px] shrink-0"
              onClick={goBack}
              disabled={pending}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          {!isLastStep ? (
            <Button type="button" size="lg" className="flex-1 min-h-[48px]" onClick={goNext}>
              Continuar
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="flex-1 min-h-[48px]"
              disabled={pending || !slot || pixBlocked}
              onClick={handleConfirm}
            >
              {pending
                ? "Processando..."
                : tenant.requirePixPayment
                  ? "Continuar para pagamento PIX"
                  : "Confirmar agendamento"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PublicBookingHeader({ tenant }: { tenant: PublicBookingData }) {
  return (
    <div className="text-center mb-8">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-3xl">
        ✂️
      </div>
      <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
      <p className="text-zinc-400 mt-1 flex items-center justify-center gap-2 text-sm">
        <Calendar className="h-4 w-4" />
        Agende seu horário online
      </p>
      {tenant.address && <p className="text-xs text-zinc-600 mt-2">{tenant.address}</p>}
      <p className="text-xs text-zinc-600 mt-1">
        <Scissors className="h-3 w-3 inline mr-1" />
        {tenant.openTime} às {tenant.closeTime}
      </p>
    </div>
  );
}
