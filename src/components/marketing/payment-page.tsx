"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/marketing/site-header";
import { useToast } from "@/components/ui/toast";
import { getSignupCheckoutPublic } from "@/lib/signup-actions";
import { formatCurrency } from "@/lib/utils";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckoutData = NonNullable<Awaited<ReturnType<typeof getSignupCheckoutPublic>>>;

function PaymentSummary({ checkout }: { checkout: CheckoutData }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Resumo</p>
      <p className="font-medium text-foreground">{checkout.barbershopName}</p>
      <p className="text-sm text-zinc-400">Plano {checkout.planLabel}</p>
      <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
        <span className="text-sm text-zinc-500">Total</span>
        <span className="text-xl font-bold text-amber-400">{formatCurrency(checkout.amount)}</span>
      </div>
    </div>
  );
}

export function PaymentPageClient({ checkoutId }: { checkoutId: string }) {
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pollError, setPollError] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const loadCheckout = useCallback(async () => {
    try {
      const data = await getSignupCheckoutPublic(checkoutId);
      setCheckout(data);
      setPollError(false);

      if (data?.status === "PAID" && data.tenantId) {
        router.push(`/assinar/sucesso?checkout=${checkoutId}`);
      }
    } catch {
      setPollError(true);
    } finally {
      setLoading(false);
    }
  }, [checkoutId, router]);

  useEffect(() => {
    loadCheckout();
    const interval = setInterval(loadCheckout, 5000);
    return () => clearInterval(interval);
  }, [loadCheckout]);

  function copyPix() {
    if (!checkout?.copiaECola) return;
    navigator.clipboard.writeText(checkout.copiaECola);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!checkout) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <p className="text-zinc-400">Pedido não encontrado.</p>
          <Link href="/assinar" className="text-amber-400 mt-4 inline-block">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-8 pb-12">
        <h1 className="text-2xl font-bold text-foreground text-center mb-2">Finalizar assinatura</h1>
        <p className="text-sm text-zinc-400 text-center mb-6">
          Conclua o pagamento para ativar sua barbearia
        </p>

        <div className="sticky top-0 z-10 -mx-1 px-1 pb-4 bg-zinc-950/95 backdrop-blur">
          <PaymentSummary checkout={checkout} />
        </div>

        <Card className="space-y-4">
          <div
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-400"
          >
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>Aguardando confirmação do pagamento...</span>
          </div>

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

          {checkout.mercadoPagoConfigured ? (
            <p className="text-sm text-zinc-400">
              Complete o pagamento na janela do Mercado Pago. Esta página atualiza automaticamente
              quando o pagamento for aprovado.
            </p>
          ) : checkout.pixConfigured && checkout.copiaECola ? (
            <>
              <p className="text-sm text-zinc-400">
                Pague via PIX abaixo. Sua barbearia é criada automaticamente após a confirmação.
              </p>
              {checkout.pixKey && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Chave PIX</p>
                  <code className="block text-sm bg-zinc-900 p-2 rounded-lg break-all text-foreground">
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
              <p className="text-xs text-zinc-500">
                Envie comprovante para {checkout.supportEmail} se a liberação demorar.
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-300">
              O pagamento online está temporariamente indisponível. Entre em contato:{" "}
              {checkout.supportEmail}
            </p>
          )}
        </Card>

        <p className="text-center text-sm text-zinc-600 mt-6">
          E-mail do cadastro: {checkout.ownerEmail}
        </p>
      </div>
    </div>
  );
}
