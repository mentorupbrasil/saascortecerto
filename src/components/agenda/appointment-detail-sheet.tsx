"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Globe,
  MessageCircle,
  Phone,
  Scissors,
  ShoppingCart,
  StickyNote,
  User,
} from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatPhone } from "@/lib/utils";
import { formatTime } from "@/lib/date-format";
import { buildWhatsAppUrl } from "@/lib/client-utils";
import { createComandaAction } from "@/lib/finance-actions";
import {
  type CalendarAppointment,
  originLabels,
  paymentLabels,
  statusBadgeColors,
  statusLabels,
} from "@/components/agenda/agenda-shared";

type ConfirmAction = "CANCELLED" | "NO_SHOW" | null;

export function AppointmentDetailSheet({
  appointment,
  open,
  onOpenChange,
  canAccessComandas,
  onReschedule,
}: {
  appointment: CalendarAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canAccessComandas: boolean;
  onReschedule?: (apt: CalendarAppointment) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  if (!appointment) return null;

  const start = new Date(appointment.scheduledAt);
  const end = new Date(start.getTime() + appointment.duration * 60_000);
  const isTerminal =
    appointment.status === "COMPLETED" || appointment.status === "CANCELLED";

  const originLabel = appointment.bookedOnline
    ? "Online"
    : appointment.origin
      ? (originLabels[appointment.origin] ?? appointment.origin)
      : "Interno";

  const waUrl = appointment.clientPhone
    ? buildWhatsAppUrl(
        appointment.clientPhone,
        `Olá ${appointment.clientName}, sobre seu horário em ${format(start, "dd/MM 'às' HH:mm", { locale: ptBR })}.`
      )
    : null;

  function handleStatus(status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW") {
    startTransition(async () => {
      try {
        const { updateAppointmentStatus } = await import("@/lib/actions");
        await updateAppointmentStatus(appointment!.id, status);
        toast.success(
          status === "CONFIRMED"
            ? "Horário confirmado"
            : status === "COMPLETED"
              ? "Horário concluído"
              : status === "NO_SHOW"
                ? "Marcado como falta"
                : "Horário cancelado"
        );
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
      }
    });
  }

  function openComanda() {
    startTransition(async () => {
      try {
        await createComandaAction({
          appointmentId: appointment!.id,
          clientId: appointment!.clientId,
        });
        toast.success("Comanda aberta");
        onOpenChange(false);
        router.push("/comandas");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao abrir comanda");
      }
    });
  }

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={appointment.clientName}
        description={`${formatTime(start)} – ${formatTime(end)} · ${appointment.serviceName}`}
        mobileVariant="sheet"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeColors[appointment.status] ?? statusBadgeColors.SCHEDULED}`}
            >
              {statusLabels[appointment.status] ?? appointment.status}
            </span>
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
              {originLabel}
            </span>
          </div>

          <dl className="space-y-3 text-sm">
            <DetailRow icon={User} label="Cliente" value={appointment.clientName} />
            {appointment.clientPhone && (
              <DetailRow
                icon={Phone}
                label="Telefone"
                value={formatPhone(appointment.clientPhone)}
              />
            )}
            <DetailRow icon={Scissors} label="Serviço" value={appointment.serviceName} />
            {appointment.barberName && (
              <DetailRow icon={User} label="Profissional" value={appointment.barberName} />
            )}
            <DetailRow
              icon={Calendar}
              label="Data"
              value={format(start, "EEEE, d 'de' MMMM", { locale: ptBR })}
            />
            <DetailRow
              icon={Clock}
              label="Horário"
              value={`${formatTime(start)} – ${formatTime(end)} (${appointment.duration} min)`}
            />
            {appointment.paymentMethod && (
              <DetailRow
                icon={Globe}
                label="Pagamento"
                value={paymentLabels[appointment.paymentMethod] ?? appointment.paymentMethod}
              />
            )}
            {appointment.notes && (
              <DetailRow icon={StickyNote} label="Observações" value={appointment.notes} />
            )}
          </dl>

          {!isTerminal && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {appointment.status === "SCHEDULED" && (
                <Button
                  className="min-h-[44px] col-span-2 sm:col-span-1"
                  disabled={pending}
                  onClick={() => handleStatus("CONFIRMED")}
                >
                  Confirmar
                </Button>
              )}
              {(appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") && (
                <>
                  <Button
                    className="min-h-[44px] bg-green-600 hover:bg-green-500 text-white"
                    disabled={pending}
                    onClick={() => handleStatus("COMPLETED")}
                  >
                    Concluir
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    disabled={pending}
                    onClick={() => setConfirmAction("NO_SHOW")}
                  >
                    Faltou
                  </Button>
                </>
              )}
              {onReschedule && (
                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  disabled={pending}
                  onClick={() => {
                    onOpenChange(false);
                    onReschedule(appointment);
                  }}
                >
                  Reagendar
                </Button>
              )}
              <Button
                variant="danger"
                className="min-h-[44px]"
                disabled={pending}
                onClick={() => setConfirmAction("CANCELLED")}
              >
                Cancelar
              </Button>
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="col-span-2"
                >
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full min-h-[44px] border-emerald-500/30 text-emerald-400"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </a>
              )}
              {canAccessComandas && (
                appointment.saleId ? (
                  <Link href="/comandas" className="col-span-2">
                    <Button variant="secondary" className="w-full min-h-[44px]">
                      <ShoppingCart className="h-4 w-4" />
                      Ver comanda
                    </Button>
                  </Link>
                ) : (
                  (appointment.status === "CONFIRMED" ||
                    appointment.status === "COMPLETED") && (
                    <Button
                      variant="secondary"
                      className="min-h-[44px] col-span-2"
                      disabled={pending}
                      onClick={openComanda}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Abrir comanda
                    </Button>
                  )
                )
              )}
            </div>
          )}

          {isTerminal && waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" className="w-full min-h-[44px]">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
            </a>
          )}
        </div>
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirmAction === "CANCELLED"}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title="Cancelar horário?"
        description="O cliente será notificado se o WhatsApp estiver configurado."
        confirmLabel="Cancelar horário"
        tone="danger"
        loading={pending}
        onConfirm={() => handleStatus("CANCELLED")}
      />

      <ConfirmDialog
        open={confirmAction === "NO_SHOW"}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title="Marcar como falta?"
        description="O cliente não compareceu ao horário agendado."
        confirmLabel="Confirmar falta"
        tone="danger"
        loading={pending}
        onConfirm={() => handleStatus("NO_SHOW")}
      />
    </>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/80" />
      <div className="min-w-0">
        <dt className="text-xs text-zinc-500">{label}</dt>
        <dd className="text-zinc-200 capitalize">{value}</dd>
      </div>
    </div>
  );
}
