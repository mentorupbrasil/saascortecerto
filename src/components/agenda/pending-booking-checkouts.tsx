"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  confirmPendingBookingCheckout,
  getPendingBookingCheckoutsForTenant,
} from "@/lib/public-booking-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreditCard } from "lucide-react";

type PendingCheckout = Awaited<
  ReturnType<typeof getPendingBookingCheckoutsForTenant>
>[number];

export function PendingBookingCheckouts() {
  const [items, setItems] = useState<PendingCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    getPendingBookingCheckoutsForTenant()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  function handleConfirm(id: string) {
    setConfirmingId(id);
    startTransition(async () => {
      try {
        await confirmPendingBookingCheckout(id);
        setItems((prev) => prev.filter((item) => item.id !== id));
        router.refresh();
      } finally {
        setConfirmingId(null);
      }
    });
  }

  if (loading || items.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Aguardando PIX do agendamento online</h3>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
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
              <p className="text-xs text-zinc-600 mt-1">
                {item.status === "AWAITING_CONFIRMATION"
                  ? "Cliente informou que pagou"
                  : "Aguardando pagamento PIX"}
              </p>
            </div>
            <Button
              size="sm"
              disabled={pending && confirmingId === item.id}
              onClick={() => handleConfirm(item.id)}
              className="shrink-0"
            >
              {pending && confirmingId === item.id ? "Confirmando..." : "Confirmar pagamento"}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
