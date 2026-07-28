"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  getPublicBookingCheckoutPublic,
  reportPublicBookingPaid,
} from "@/lib/public-booking-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CheckoutData = NonNullable<Awaited<ReturnType<typeof getPublicBookingCheckoutPublic>>>;

function useCountdown(expiresAt: string | null | undefined, active: boolean) {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt || !active) {
      setRemaining(null);
      return;
    }

    function tick() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Expirado");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    }

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, active]);

  return remaining;
}

function PaymentSummary({ checkout }: { checkout: CheckoutData }) {
  const when = format(new Date(checkout.scheduledAt), "EEEE, dd/MM 'às' HH:mm", {
    locale: ptBR,
  });

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Resumo</p>
      <p className="font-medium text-white">{checkout.serviceName}</p>
      <p className="text-sm text-zinc-400 capitalize">{when}</p>
      <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
        <span className="text-sm text-zinc-500">Total</span>
        <span className="text-xl font-bold text-amber-400">{formatCurrency(checkout.amount)}</span>
      </div>
    </div>
  );
}

export function PublicBookingPaymentClient({
  slug,
  checkoutId,
}: {
  slug: string;
  checkoutId: string;
}) {
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [pollError, setPollError] = useState(false);
  const toast = useToast();

  const loadCheckout = useCallback(async () => {
    try {
      const data = await getPublicBookingCheckoutPublic(slug, checkoutId);
      setCheckout(data);
      setPollError(false);
    } catch {
      setPollError(true);
    } finally {
      setLoading(false);
    }
  }, [slug, checkoutId]);

  useEffect(() => {
    loadCheckout();
    const interval = setInterval(loadCheckout, 4000);
    return () => clearInterval(interval);
  }, [loadCheckout]);

  const countdown = useCountdown(
    checkout?.expiresAt,
    checkout?.status === "PENDING_PAYMENT" || checkout?.status === "AWAITING_CONFIRMATION"
  );

  function copyPix() {
    if (!checkout?.copiaECola) return;
    navigator.clipboard.writeText(checkout.copiaECola);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleReportPaid() {
    setReporting(true);
    try {
      await reportPublicBookingPaid(slug, checkoutId);
      await loadCheckout();
      toast.success("Pagamento informado à barbearia");
    } catch {
      toast.error("Não foi possível enviar. Tente novamente.");
    } finally {
      setReporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!checkout) {
    return (
      <Card className="text-center">
        <p className="text-zinc-400">Reserva não encontrada.</p>
        <Link href={`/agendar/${slug}`} className="text-amber-400 mt-4 inline-block text-sm">
          Voltar ao agendamento
        </Link>
      </Card>
    );
  }

  if (checkout.status === "PAID") {
    const when = format(new Date(checkout.scheduledAt), "EEEE, dd/MM 'às' HH:mm", {
      locale: ptBR,
    });

    return (
      <Card className="text-center">
        <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Agendamento confirmado!</h2>
        <PaymentSummary checkout={checkout} />
        <p className="text-sm text-zinc-500 mt-4 mb-4">Pagamento recebido. A barbearia foi avisada.</p>
        {checkout.clientWaUrl && (
          <a
            href={checkout.clientWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-green-400 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Enviar confirmação no WhatsApp
          </a>
        )}
      </Card>
    );
  }

  if (checkout.status === "EXPIRED") {
    return (
      <Card className="text-center">
        <CalendarClock className="h-12 w-12 text-zinc-500 mx-auto mb-4" />
        <p className="text-zinc-300 font-medium mb-2">Reserva expirada</p>
        <p className="text-sm text-zinc-500 mb-4">
          O horário foi liberado. Escolha novamente data e horário.
        </p>
        <Link href={`/agendar/${slug}`}>
          <Button className="min-h-[48px]">Escolher outro horário</Button>
        </Link>
      </Card>
    );
  }

  const whenShort = format(new Date(checkout.scheduledAt), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  const statusLabel =
    checkout.status === "AWAITING_CONFIRMATION"
      ? "Aguardando confirmação da barbearia"
      : checkout.autoConfirm
        ? "Aguardando confirmação automática"
        : "Aguardando pagamento";

  return (
    <div className="space-y-4 pb-4">
      <div className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-3 bg-zinc-950/95 backdrop-blur">
        <PaymentSummary checkout={checkout} />
      </div>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Pague com PIX para confirmar</h2>
          <p className="text-sm text-zinc-400 mt-1">{whenShort}</p>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
            checkout.status === "AWAITING_CONFIRMATION"
              ? "bg-amber-500/10 text-amber-300"
              : "bg-zinc-900 text-zinc-400"
          )}
        >
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>{statusLabel}</span>
        </div>

        {countdown && checkout.status === "PENDING_PAYMENT" && (
          <p className="text-sm text-zinc-500">
            Tempo restante para pagar:{" "}
            <span className="font-mono text-amber-400">{countdown}</span>
          </p>
        )}

        {pollError && (
          <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-3 flex items-start gap-2 text-sm">
            <RefreshCw className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-zinc-300">Conexão instável</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Estamos tentando reconectar. Se já pagou, aguarde — a página atualiza sozinha.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => loadCheckout()}
              >
                Atualizar agora
              </Button>
            </div>
          </div>
        )}

        {checkout.qrCodeBase64 && (
          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${checkout.qrCodeBase64}`}
              alt="QR Code PIX"
              className="w-52 h-52 sm:w-56 sm:h-56 rounded-xl border border-zinc-800 bg-white p-2"
            />
          </div>
        )}

        {checkout.copiaECola ? (
          <>
            <p className="text-sm text-zinc-400">
              {checkout.autoConfirm
                ? "Escaneie o QR ou copie o código. A confirmação é automática em alguns segundos."
                : "Escaneie o QR ou copie o código PIX abaixo."}
            </p>
            {checkout.pixKey && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Chave PIX · {checkout.holderName}</p>
                <code className="block text-sm bg-zinc-900 p-2 rounded-lg break-all text-white">
                  {checkout.pixKey}
                </code>
              </div>
            )}
            <Button
              type="button"
              size="lg"
              className={cn(
                "w-full min-h-[52px] text-base",
                copied && "bg-emerald-600 hover:bg-emerald-600"
              )}
              onClick={copyPix}
            >
              <Copy className="h-5 w-5 mr-2" />
              {copied ? "PIX copiado!" : "Copiar código PIX"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-amber-300 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando PIX... aguarde alguns instantes.
          </p>
        )}

        {!checkout.autoConfirm && checkout.status === "PENDING_PAYMENT" && (
          <Button
            type="button"
            variant="secondary"
            className="w-full min-h-[48px]"
            disabled={reporting}
            onClick={handleReportPaid}
          >
            {reporting ? "Enviando..." : "Já paguei — avisar barbearia"}
          </Button>
        )}

        {checkout.status === "AWAITING_CONFIRMATION" && (
          <p className="text-sm text-amber-400 text-center">
            Pagamento informado. A barbearia vai confirmar em breve.
          </p>
        )}

        <Link
          href={`/agendar/${slug}`}
          className="block text-center text-sm text-zinc-500 hover:text-amber-400 pt-2"
        >
          Trocar horário
        </Link>
      </Card>
    </div>
  );
}
