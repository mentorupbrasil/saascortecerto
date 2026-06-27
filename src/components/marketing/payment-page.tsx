"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/marketing/site-header";
import { getSignupCheckoutPublic } from "@/lib/signup-actions";
import { formatCurrency } from "@/lib/utils";
import { Copy, Loader2 } from "lucide-react";

type CheckoutData = Awaited<ReturnType<typeof getSignupCheckoutPublic>>;

export function PaymentPageClient({ checkoutId }: { checkoutId: string }) {
  const [checkout, setCheckout] = useState<CheckoutData>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    async function load() {
      const data = await getSignupCheckoutPublic(checkoutId);
      setCheckout(data);
      setLoading(false);

      if (data?.status === "PAID" && data.tenantId) {
        router.push(`/assinar/sucesso?checkout=${checkoutId}`);
      }
    }

    load();
    interval = setInterval(load, 5000);

    return () => clearInterval(interval);
  }, [checkoutId, router]);

  function copyPix() {
    if (!checkout?.copiaECola) return;
    navigator.clipboard.writeText(checkout.copiaECola);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="min-h-screen bg-zinc-950">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Finalizar assinatura</h1>
        <p className="text-sm text-zinc-400 text-center mb-8">
          {checkout.barbershopName} · Plano {checkout.planLabel}
        </p>

        <Card className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Valor</span>
            <span className="text-xl font-bold text-amber-400">
              {formatCurrency(checkout.amount)}
            </span>
          </div>

          {checkout.mercadoPagoConfigured ? (
            <p className="text-sm text-zinc-400">
              Aguardando confirmação do Mercado Pago. Esta página atualiza automaticamente quando
              o pagamento for aprovado.
            </p>
          ) : checkout.pixConfigured && checkout.copiaECola ? (
            <>
              <p className="text-sm text-zinc-400">
                Pague via PIX. Após confirmação, sua barbearia é criada automaticamente (configure
                Mercado Pago para ativação instantânea).
              </p>
              {checkout.pixKey && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Chave PIX</p>
                  <code className="block text-sm bg-zinc-900 p-2 rounded-lg break-all">
                    {checkout.pixKey}
                  </code>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500 mb-1">PIX copia e cola</p>
                <code className="block text-xs bg-zinc-900 p-2 rounded-lg break-all max-h-24 overflow-y-auto">
                  {checkout.copiaECola}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={copyPix}
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copiado!" : "Copiar PIX"}
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                Envie comprovante para {checkout.supportEmail} se a liberação demorar.
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-300">
              Configure MERCADOPAGO_ACCESS_TOKEN ou PLATFORM_PIX_KEY para pagamentos online.
              Entre em contato: {checkout.supportEmail}
            </p>
          )}

          <div className="flex items-center gap-2 text-sm text-zinc-500 pt-2 border-t border-zinc-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            Aguardando pagamento...
          </div>
        </Card>

        <p className="text-center text-sm text-zinc-600 mt-6">
          E-mail do cadastro: {checkout.ownerEmail}
        </p>
      </div>
    </div>
  );
}
