"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppointmentActions } from "@/components/appointments/appointment-components";
import { StatusBadge } from "@/components/appointments/status-badge";
import { confirmPendingBookingCheckout } from "@/lib/public-booking-actions";
import { formatCurrency } from "@/lib/utils";
import { formatTime } from "@/lib/date-format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreditCard, Globe } from "lucide-react";

export type PendingCheckoutItem = {
  id: string;
  status: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  scheduledAt: string;
  amount: number;
  expiresAt: string;
  autoPix?: boolean;
};

export type OnlineAppointmentItem = {
  id: string;
  clientName: string;
  serviceName: string;
  scheduledAt: string;
  status: string;
};

export function OnlineBookingsPanel({
  pendingCheckouts,
  onlineAppointments,
}: {
  pendingCheckouts: PendingCheckoutItem[];
  onlineAppointments: OnlineAppointmentItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const router = useRouter();

  if (pendingCheckouts.length === 0 && onlineAppointments.length === 0) {
    return null;
  }

  function handleConfirmCheckout(id: string) {
    setConfirmingId(id);
    startTransition(async () => {
      try {
        await confirmPendingBookingCheckout(id);
        router.refresh();
      } finally {
        setConfirmingId(null);
      }
    });
  }

  return (
    <div id="online-bookings" className="space-y-4 scroll-mt-24">
      {pendingCheckouts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Aguardando PIX ({pendingCheckouts.length})
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            Reservas do link público. Confirme o pagamento para liberar o horário na agenda.
          </p>
          <div className="space-y-3">
            {pendingCheckouts.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.clientName}</p>
                  <p className="text-xs text-zinc-500">
                    {item.serviceName} ·{" "}
                    {format(new Date(item.scheduledAt), "dd/MM 'às' HH:mm", { locale: ptBR })} ·{" "}
                    {formatCurrency(item.amount)}
                  </p>
                  <p className="text-xs text-amber-400/80 mt-1">
                    {item.autoPix
                      ? "PIX automático — aguardando pagamento do cliente"
                      : item.status === "AWAITING_CONFIRMATION"
                        ? "Cliente informou que pagou — confirme abaixo"
                        : "Aguardando pagamento PIX do cliente"}
                  </p>
                </div>
                {!item.autoPix && (
                  <Button
                    size="sm"
                    disabled={pending && confirmingId === item.id}
                    onClick={() => handleConfirmCheckout(item.id)}
                    className="shrink-0"
                  >
                    {pending && confirmingId === item.id
                      ? "Confirmando..."
                      : "Confirmar pagamento"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {onlineAppointments.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-green-400" />
            <h3 className="text-sm font-semibold text-white">
              Agendamentos online ({onlineAppointments.length})
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            Clientes que agendaram pelo link. Confirme ou gerencie o status.
          </p>
          <div className="space-y-2">
            {onlineAppointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {formatTime(apt.scheduledAt)} · {apt.clientName}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{apt.serviceName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={apt.status} />
                  <AppointmentActions id={apt.id} status={apt.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
