"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState, FixedActionBar } from "@/components/ui/page-chrome";
import { Plus, Clock, MessageCircle } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
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

const PERIODS = [
  { id: "morning", label: "Manhã", start: "08:00", end: "12:00" },
  { id: "afternoon", label: "Tarde", start: "12:00", end: "18:00" },
  { id: "evening", label: "Noite", start: "18:00", end: "22:00" },
];

function nextDays(count: number) {
  const days: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      value: d.toISOString().slice(0, 10),
      label: format(d, "EEE dd/MM", { locale: ptBR }),
    });
  }
  return days;
}

export function WaitlistPanel({
  entries,
  formOptions,
}: {
  entries: WaitlistEntry[];
  formOptions: FormOptions;
}) {
  const [open, setOpen] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [period, setPeriod] = useState("afternoon");
  const [offerDate, setOfferDate] = useState(new Date().toISOString().slice(0, 10));
  const [offerTime, setOfferTime] = useState("10:00");
  const [offerHours, setOfferHours] = useState("2");
  const router = useRouter();
  const toast = useToast();
  const dayOptions = useMemo(() => nextDays(14), []);

  const offerEntry = entries.find((e) => e.id === offerId) ?? null;
  const offerPreview = useMemo(() => {
    if (!offerEntry) return "";
    const when = `${offerDate} ${offerTime}`;
    return `Olá ${offerEntry.clientName}! Temos uma vaga para ${offerEntry.service.name} em ${format(new Date(`${offerDate}T${offerTime}`), "dd/MM 'às' HH:mm", { locale: ptBR })}. Responda para confirmar.`;
  }, [offerEntry, offerDate, offerTime]);

  function toggleDate(value: string) {
    setSelectedDates((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  }

  function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const periodMeta = PERIODS.find((p) => p.id === period);
    if (periodMeta) {
      formData.set("preferredTimeStart", periodMeta.start);
      formData.set("preferredTimeEnd", periodMeta.end);
    }
    formData.set("preferredDates", selectedDates.join(","));

    if (mode === "existing") {
      const clientId = String(formData.get("clientId") || "");
      const client = formOptions.clients.find((c) => c.id === clientId);
      if (!client) {
        setError("Selecione um cliente");
        return;
      }
      formData.set("clientName", client.name);
      formData.set("clientPhone", client.phone);
    }

    startTransition(async () => {
      try {
        await joinWaitlistAction(formData);
        setOpen(false);
        setSelectedDates([]);
        toast.success("Adicionado à lista de espera");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao salvar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleOfferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!offerId) return;
    const slotAt = new Date(`${offerDate}T${offerTime}:00`).toISOString();
    startTransition(async () => {
      try {
        await offerWaitlistSlotAction(offerId, slotAt);
        setOfferId(null);
        toast.success("Vaga oferecida");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao oferecer vaga");
      }
    });
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <div className="hidden justify-end lg:flex">
        <Button className="min-h-[44px]" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Adicionar à fila
        </Button>
      </div>

      <div className="grid gap-3">
        {entries.map((entry) => {
          const wa = `https://wa.me/55${entry.clientPhone.replace(/\D/g, "")}`;
          return (
            <Card key={entry.id}>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-white">{entry.clientName}</p>
                  <p className="text-sm text-zinc-400">{formatPhone(entry.clientPhone)}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {entry.service.name}
                    {entry.barber ? ` · ${entry.barber.name}` : " · Qualquer profissional"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-300">
                    {STATUS_LABELS[entry.status] ?? entry.status}
                  </span>
                  {entry.priority > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-400">
                      Prioridade {entry.priority}
                    </span>
                  )}
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-400">
                    Na fila{" "}
                    {formatDistanceToNow(new Date(entry.createdAt), {
                      locale: ptBR,
                      addSuffix: false,
                    })}
                  </span>
                </div>
                {entry.preferredDates && (
                  <p className="text-xs text-zinc-500">Preferências: {entry.preferredDates}</p>
                )}
                {entry.offeredSlotAt && (
                  <p className="flex items-center gap-1 text-xs text-amber-400">
                    <Clock className="h-3 w-3" />
                    Oferta:{" "}
                    {format(new Date(entry.offeredSlotAt), "dd/MM HH:mm", { locale: ptBR })}
                    {entry.offerExpiresAt &&
                      ` · expira ${format(new Date(entry.offerExpiresAt), "dd/MM HH:mm", { locale: ptBR })}`}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  {entry.status === "PENDING" && (
                    <Button
                      className="min-h-[44px] flex-1"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => setOfferId(entry.id)}
                    >
                      Oferecer vaga
                    </Button>
                  )}
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                  {entry.status !== "CANCELLED" && entry.status !== "BOOKED" && (
                    <Button
                      className="min-h-[44px] flex-1"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setCancelId(entry.id)}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {entries.length === 0 && (
          <EmptyState
            title="Fila vazia"
            description="Adicione clientes que querem ser avisados quando surgir um horário."
          />
        )}
      </div>

      <div className="lg:hidden">
        <FixedActionBar>
          <Button className="min-h-[44px] w-full" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Adicionar à fila
          </Button>
        </FixedActionBar>
      </div>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Nova entrada na fila"
        mobileVariant="full"
        footer={
          <Button form="waitlist-join" type="submit" className="w-full min-h-[44px]" disabled={pending}>
            {pending ? "Salvando..." : "Adicionar"}
          </Button>
        }
      >
        <form id="waitlist-join" onSubmit={handleJoin} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`min-h-[44px] rounded-xl border px-3 text-sm ${
                mode === "existing"
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-border text-zinc-400"
              }`}
              onClick={() => setMode("existing")}
            >
              Cliente existente
            </button>
            <button
              type="button"
              className={`min-h-[44px] rounded-xl border px-3 text-sm ${
                mode === "new"
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-border text-zinc-400"
              }`}
              onClick={() => setMode("new")}
            >
              Novo cliente
            </button>
          </div>

          {mode === "existing" ? (
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Cliente</label>
              <select
                name="clientId"
                required
                className="w-full min-h-[44px] rounded-xl border border-border bg-input px-3 text-sm text-foreground"
              >
                <option value="">Selecione...</option>
                {formOptions.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {formatPhone(c.phone)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <Input name="clientName" label="Nome" required />
              <Input name="clientPhone" label="Telefone" required placeholder="(11) 99999-9999" />
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">Serviço</label>
            <select
              name="serviceId"
              required
              className="w-full min-h-[44px] rounded-xl border border-border bg-input px-3 text-sm text-foreground"
            >
              {formOptions.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">
              Profissional (opcional)
            </label>
            <select
              name="barberId"
              className="w-full min-h-[44px] rounded-xl border border-border bg-input px-3 text-sm text-foreground"
            >
              <option value="">Qualquer</option>
              {formOptions.barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-sm text-muted-foreground">Datas preferidas</p>
            <div className="flex flex-wrap gap-2">
              {dayOptions.map((d) => {
                const active = selectedDates.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDate(d.value)}
                    className={`min-h-[40px] rounded-full border px-3 text-xs capitalize ${
                      active
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                        : "border-border text-zinc-400"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-muted-foreground">Período preferido</p>
            <div className="grid grid-cols-3 gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`min-h-[44px] rounded-xl border text-sm ${
                    period === p.id
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                      : "border-border text-zinc-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Input name="priority" label="Prioridade" type="number" min={0} defaultValue={0} />
          <Textarea name="notes" label="Observações" />
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
        </form>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={!!offerId}
        onOpenChange={(o) => !o && setOfferId(null)}
        title="Oferecer vaga"
        mobileVariant="sheet"
        footer={
          <div className="flex flex-col gap-2">
            {offerEntry && (
              <a
                href={`https://wa.me/55${offerEntry.clientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(offerPreview)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-secondary text-sm font-medium"
              >
                <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
              </a>
            )}
            <Button
              form="waitlist-offer"
              type="submit"
              className="w-full min-h-[44px]"
              disabled={pending}
            >
              {pending ? "Enviando..." : "Confirmar oferta"}
            </Button>
          </div>
        }
      >
        <form id="waitlist-offer" onSubmit={handleOfferSubmit} className="space-y-3">
          <Input
            type="date"
            label="Data"
            value={offerDate}
            onChange={(e) => setOfferDate(e.target.value)}
            required
          />
          <Input
            type="time"
            label="Horário"
            value={offerTime}
            onChange={(e) => setOfferTime(e.target.value)}
            required
          />
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">Profissional</label>
            <select className="w-full min-h-[44px] rounded-xl border border-border bg-input px-3 text-sm">
              <option value="">
                {offerEntry?.barber?.name ?? "Qualquer / o da preferência"}
              </option>
              {formOptions.barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            type="number"
            min={1}
            label="Validade da oferta (horas)"
            value={offerHours}
            onChange={(e) => setOfferHours(e.target.value)}
          />
          <div className="rounded-xl bg-zinc-900 px-3 py-3 text-sm text-zinc-300">
            <p className="mb-1 text-xs text-zinc-500">Preview da mensagem</p>
            {offerPreview}
          </div>
        </form>
      </ResponsiveDialog>

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(o) => !o && setCancelId(null)}
        title="Remover da lista de espera?"
        description="O cliente deixará de receber ofertas desta fila."
        confirmLabel="Remover"
        tone="danger"
        loading={pending}
        onConfirm={async () => {
          if (!cancelId) return;
          await cancelWaitlistEntryAction(cancelId);
          toast.success("Removido da fila");
          router.refresh();
        }}
      />
    </div>
  );
}
