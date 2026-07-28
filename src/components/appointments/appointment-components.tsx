"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { FixedActionBar } from "@/components/ui/page-chrome";
import { useToast } from "@/components/ui/toast";
import { createAppointment, rescheduleAppointmentAction } from "@/lib/actions";
import { formatPhone } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CreditCard,
  Plus,
  Scissors,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Service = {
  id: string;
  name: string;
  price: string | number | { toString(): string };
  duration: number;
};
type Barber = { id: string; name: string };

export type ReschedulePrefill = {
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  serviceId?: string;
  barberId?: string;
  notes?: string;
};

type FormData = {
  clientName: string;
  clientPhone: string;
  serviceId: string;
  barberId: string;
  scheduledAt: string;
  paymentMethod: string;
  notes: string;
};

const STEPS = [
  { id: 1, label: "Cliente", icon: User },
  { id: 2, label: "Serviço", icon: Scissors },
  { id: 3, label: "Profissional", icon: User },
  { id: 4, label: "Data/hora", icon: Calendar },
  { id: 5, label: "Pagamento", icon: CreditCard },
  { id: 6, label: "Revisar", icon: Check },
] as const;

const EMPTY_FORM: FormData = {
  clientName: "",
  clientPhone: "",
  serviceId: "",
  barberId: "",
  scheduledAt: "",
  paymentMethod: "",
  notes: "",
};

export function NewAppointmentModal({
  services,
  barbers,
  defaultDate,
  prefill,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  services: Service[];
  barbers: Barber[];
  defaultDate?: string;
  prefill?: ReschedulePrefill;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const toast = useToast();

  const isReschedule = Boolean(prefill);
  const totalSteps = STEPS.length;
  const selectedService = services.find((s) => s.id === form.serviceId);
  const selectedBarber = barbers.find((b) => b.id === form.barberId);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const defaultDateTime = defaultDate ?? format(now, "yyyy-MM-dd'T'HH:mm");
    setForm({
      ...EMPTY_FORM,
      clientName: prefill?.clientName ?? "",
      clientPhone: prefill?.clientPhone ?? "",
      serviceId: prefill?.serviceId ?? "",
      barberId: prefill?.barberId ?? "",
      notes: prefill?.notes ?? "",
      scheduledAt: defaultDate ?? defaultDateTime,
    });
    setStep(prefill ? 4 : 1);
    setError("");
  }, [open, defaultDate, prefill]);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return form.clientName.trim().length >= 2 && form.clientPhone.replace(/\D/g, "").length >= 10;
      case 2:
        return Boolean(form.serviceId);
      case 3:
        return true;
      case 4:
        return Boolean(form.scheduledAt);
      case 5:
        return true;
      case 6:
        return true;
      default:
        return false;
    }
  }

  function handleNext() {
    if (!canAdvance()) {
      setError("Preencha os campos obrigatórios antes de continuar.");
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, totalSteps));
  }

  function handleBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleSubmit() {
    setError("");

    if (isReschedule && prefill?.appointmentId) {
      startTransition(async () => {
        try {
          await rescheduleAppointmentAction({
            appointmentId: prefill.appointmentId,
            scheduledAt: form.scheduledAt,
            barberId: form.barberId || null,
          });
          toast.success("Horário reagendado");
          setOpen(false);
          router.refresh();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro ao reagendar";
          setError(msg);
          toast.error(msg);
        }
      });
      return;
    }

    const fd = new FormData();
    fd.set("clientName", form.clientName);
    fd.set("clientPhone", form.clientPhone);
    fd.set("serviceId", form.serviceId);
    if (form.barberId) fd.set("barberId", form.barberId);
    fd.set("scheduledAt", form.scheduledAt);
    if (form.paymentMethod) fd.set("paymentMethod", form.paymentMethod);
    if (form.notes) fd.set("notes", form.notes);

    startTransition(async () => {
      try {
        await createAppointment(fd);
        toast.success("Agendamento criado");
        setOpen(false);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao criar agendamento";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  const stepTitle = isReschedule && step >= 4 ? "Reagendar horário" : "Novo horário";
  const stepDescription =
    step <= totalSteps ? `${step} de ${totalSteps} · ${STEPS[step - 1]?.label}` : undefined;

  const footer = (
    <div className="flex gap-2">
      {step > 1 ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-[44px] flex-1"
          onClick={handleBack}
          disabled={pending}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="min-h-[44px] flex-1"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      )}
      {step < totalSteps ? (
        <Button
          type="button"
          className="min-h-[44px] flex-1"
          onClick={handleNext}
          disabled={pending}
        >
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          className="min-h-[44px] flex-1"
          onClick={handleSubmit}
          disabled={pending}
        >
          {pending ? "Salvando..." : "Agendar"}
        </Button>
      )}
    </div>
  );

  return (
    <>
      {!hideTrigger && (
        <Button size="lg" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
          <Plus className="h-5 w-5" />
          Novo horário
        </Button>
      )}

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={stepTitle}
        description={stepDescription}
        mobileVariant="full"
        dirty={form.clientName !== "" || form.serviceId !== ""}
        footer={
          <>
            {/* Desktop footer inline */}
            <div className="hidden lg:block">{footer}</div>
            {/* Mobile fixed bar */}
            <div className="lg:hidden">
              <FixedActionBar className="!static !border-0 !bg-transparent !p-0">
                {footer}
              </FixedActionBar>
            </div>
          </>
        }
      >
        {/* Step indicator — mobile */}
        <div className="mb-5 flex gap-1 lg:hidden">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s.id <= step ? "bg-amber-500" : "bg-zinc-800"
              }`}
            />
          ))}
        </div>

        {/* Step indicator — desktop compact */}
        <div className="mb-5 hidden flex-wrap gap-2 lg:flex">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => s.id < step && setStep(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  s.id === step
                    ? "bg-amber-500/20 text-amber-400"
                    : s.id < step
                      ? "text-zinc-400 hover:bg-zinc-800"
                      : "text-zinc-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>

        {isReschedule && step >= 4 && (
          <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            Reagendando o horário de {prefill?.clientName}.
          </p>
        )}

        <div className="space-y-4">
          {step === 1 && (
            <>
              <Input
                label="Nome do cliente"
                required
                placeholder="João Silva"
                value={form.clientName}
                onChange={(e) => update("clientName", e.target.value)}
              />
              <Input
                label="Telefone"
                required
                placeholder="(11) 99999-9999"
                value={form.clientPhone}
                onChange={(e) => update("clientPhone", e.target.value)}
              />
            </>
          )}

          {step === 2 && (
            <Select
              label="Serviço"
              required
              value={form.serviceId}
              onChange={(e) => update("serviceId", e.target.value)}
            >
              <option value="">Selecione...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — R$ {Number(s.price).toFixed(2)} · {s.duration} min
                </option>
              ))}
            </Select>
          )}

          {step === 3 && (
            <>
              {barbers.length > 0 ? (
                <Select
                  label="Profissional"
                  value={form.barberId}
                  onChange={(e) => update("barberId", e.target.value)}
                >
                  <option value="">Qualquer disponível</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm text-zinc-500">Nenhum profissional cadastrado.</p>
              )}
            </>
          )}

          {step === 4 && (
            <Input
              label="Data e hora"
              type="datetime-local"
              required
              value={form.scheduledAt}
              onChange={(e) => update("scheduledAt", e.target.value)}
            />
          )}

          {step === 5 && (
            <>
              <Select
                label="Forma de pagamento"
                value={form.paymentMethod}
                onChange={(e) => update("paymentMethod", e.target.value)}
              >
                <option value="">A definir</option>
                <option value="PIX">PIX</option>
                <option value="CASH">Dinheiro</option>
                <option value="CARD">Cartão</option>
              </Select>
              <Textarea
                label="Observações"
                placeholder="Opcional"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </>
          )}

          {step === 6 && (
            <dl className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
              <ReviewRow label="Cliente" value={form.clientName} />
              <ReviewRow label="Telefone" value={formatPhone(form.clientPhone)} />
              <ReviewRow
                label="Serviço"
                value={
                  selectedService
                    ? `${selectedService.name} · R$ ${Number(selectedService.price).toFixed(2)}`
                    : "—"
                }
              />
              <ReviewRow
                label="Profissional"
                value={selectedBarber?.name ?? "Qualquer disponível"}
              />
              <ReviewRow
                label="Data e hora"
                value={
                  form.scheduledAt
                    ? format(new Date(form.scheduledAt), "EEEE, d 'de' MMMM 'às' HH:mm", {
                        locale: ptBR,
                      })
                    : "—"
                }
              />
              {form.paymentMethod && (
                <ReviewRow label="Pagamento" value={form.paymentMethod} />
              )}
              {form.notes && <ReviewRow label="Observações" value={form.notes} />}
            </dl>
          )}

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
        </div>
      </ResponsiveDialog>
    </>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-200 capitalize">{value}</dd>
    </div>
  );
}

/** Compact inline actions for desktop grid cards (optional) */
export function AppointmentActions({
  id,
  status,
  variant = "compact",
}: {
  id: string;
  status: string;
  variant?: "compact" | "full";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleStatus(newStatus: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW") {
    startTransition(async () => {
      try {
        const { updateAppointmentStatus } = await import("@/lib/actions");
        await updateAppointmentStatus(id, newStatus);
        toast.success("Status atualizado");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
      }
    });
  }

  if (status === "COMPLETED" || status === "CANCELLED") return null;

  if (variant === "full") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {status === "SCHEDULED" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => handleStatus("CONFIRMED")}
            className="min-h-[44px]"
          >
            Confirmar
          </Button>
        )}
        {(status === "SCHEDULED" || status === "CONFIRMED") && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => handleStatus("COMPLETED")}
            className="min-h-[44px] bg-green-600 hover:bg-green-500"
          >
            Concluir
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => handleStatus("CANCELLED")}
          className="min-h-[44px]"
        >
          Cancelar
        </Button>
      </div>
    );
  }

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
