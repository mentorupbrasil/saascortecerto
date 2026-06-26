"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getPublicBookingCheckoutPublic,
  reportPublicBookingPaid,
} from "@/lib/public-booking-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";

type CheckoutData = NonNullable<Awaited<ReturnType<typeof getPublicBookingCheckoutPublic>>>;

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

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    async function load() {
      const data = await getPublicBookingCheckoutPublic(slug, checkoutId);
      setCheckout(data);
      setLoading(false);
    }

    load();
    interval = setInterval(load, 4000);

    return () => clearInterval(interval);
  }, [slug, checkoutId]);

  function copyPix() {
    if (!checkout?.copiaECola) return;
    navigator.clipboard.writeText(checkout.copiaECola);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleReportPaid() {
    setReporting(true);
    try {
      await reportPublicBookingPaid(slug, checkoutId);
      const data = await getPublicBookingCheckoutPublic(slug, checkoutId);
      setCheckout(data);
    } catch {
      // auto mode — ignore
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
        <p className="text-zinc-400 mb-1">{checkout.serviceName}</p>
        <p className="text-amber-400 font-medium capitalize mb-6">{when}</p>
        <p className="text-sm text-zinc-500 mb-4">
          Pagamento recebido. A barbearia foi avisada.
        </p>
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
        <p className="text-zinc-300 font-medium mb-2">Reserva expirada</p>
        <p className="text-sm text-zinc-500 mb-4">
          O horário foi liberado. Escolha novamente data e horário.
        </p>
        <Link href={`/agendar/${slug}`}>
          <Button>Agendar de novo</Button>
        </Link>
      </Card>
    );
  }

  const when = format(new Date(checkout.scheduledAt), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });
  const expiresAt = format(new Date(checkout.expiresAt), "HH:mm", { locale: ptBR });

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Pague com PIX para confirmar</h2>
        <p className="text-sm text-zinc-400 mt-1">
          {checkout.serviceName} · {when}
        </p>
      </div>

      <div className="rounded-xl bg-zinc-900 p-4 flex justify-between items-center">
        <span className="text-zinc-400 text-sm">Valor</span>
        <span className="text-xl font-bold text-amber-400">{formatCurrency(checkout.amount)}</span>
      </div>

      {checkout.qrCodeBase64 && (
        <div className="flex justify-center">
          <img
            src={`data:image/png;base64,${checkout.qrCodeBase64}`}
            alt="QR Code PIX"
            className="w-48 h-48 rounded-xl border border-zinc-800 bg-white p-2"
          />
        </div>
      )}

      {checkout.copiaECola ? (
        <>
          <p className="text-sm text-zinc-400">
            {checkout.autoConfirm
              ? "Pague o PIX abaixo. O agendamento confirma automaticamente em alguns segundos."
              : "Pague o PIX abaixo. Após pagar, toque em “Já paguei” para avisar a barbearia."}
          </p>
          {checkout.pixKey && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Chave PIX · {checkout.holderName}</p>
              <code className="block text-sm bg-zinc-900 p-2 rounded-lg break-all text-white">
                {checkout.pixKey}
              </code>
            </div>
          )}
          <div>
            <p className="text-xs text-zinc-500 mb-1">PIX copia e cola</p>
            <code className="block text-xs bg-zinc-900 p-2 rounded-lg break-all max-h-24 overflow-y-auto text-zinc-300">
              {checkout.copiaECola}
            </code>
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={copyPix}>
              <Copy className="h-4 w-4" />
              {copied ? "Copiado!" : "Copiar PIX"}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-amber-300">Gerando PIX... atualize em instantes.</p>
      )}

      <div className="flex items-center gap-2 text-sm text-zinc-500 pt-2 border-t border-zinc-800">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        {checkout.autoConfirm
          ? "Aguardando confirmação automática do pagamento..."
          : "Horário reservado temporariamente até " + expiresAt}
      </div>

      {!checkout.autoConfirm && checkout.status === "PENDING_PAYMENT" && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
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
    </Card>
  );
}
