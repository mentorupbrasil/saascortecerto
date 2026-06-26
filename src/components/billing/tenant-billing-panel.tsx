"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getTenantPaymentPixPayload,
  reportTenantPayment,
  type TenantBillingOverview,
  type TenantInvoiceRow,
} from "@/lib/billing-actions";
import { formatPlanPrice } from "@/lib/plan-pricing";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  X,
} from "lucide-react";

export function TenantBillingPanel({
  billing,
  isOwner,
  supportEmail,
}: {
  billing: TenantBillingOverview;
  isOwner: boolean;
  supportEmail: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-amber-500/20">
          <p className="text-sm text-zinc-400">Seu plano</p>
          <p className="text-xl font-bold text-white">{billing.planLabel}</p>
          <p className="text-sm text-amber-400">
            {billing.plan === "FREE"
              ? "Gratuito"
              : `${formatPlanPrice(billing.plan)}/mês`}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Próximo vencimento</p>
          <p className="text-xl font-bold text-white">
            {billing.openInvoice
              ? format(new Date(billing.openInvoice.dueDate), "dd/MM/yyyy", { locale: ptBR })
              : "—"}
          </p>
          {billing.daysUntilDue !== null && billing.openInvoice && (
            <p className="text-sm text-zinc-500">
              {billing.daysUntilDue < 0
                ? `${Math.abs(billing.daysUntilDue)} dia(s) em atraso`
                : billing.daysUntilDue === 0
                  ? "Vence hoje"
                  : `Em ${billing.daysUntilDue} dia(s)`}
            </p>
          )}
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Valor em aberto</p>
          <p className="text-xl font-bold text-amber-400">
            {billing.openInvoice ? formatCurrency(billing.openInvoice.amount) : formatCurrency(0)}
          </p>
        </Card>
      </div>

      {billing.openInvoice && billing.alertMessage && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
            billing.alertLevel === "overdue"
              ? "border-red-500/30 bg-red-500/10"
              : billing.alertLevel === "due_soon"
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-blue-500/20 bg-blue-500/10"
          }`}
        >
          <AlertTriangle
            className={`h-5 w-5 shrink-0 mt-0.5 ${
              billing.alertLevel === "overdue"
                ? "text-red-400"
                : billing.alertLevel === "due_soon"
                  ? "text-amber-400"
                  : "text-blue-400"
            }`}
          />
          <div>
            <p className="text-sm font-medium text-white">{billing.alertMessage}</p>
            <p className="text-xs text-zinc-400 mt-1">
              O bloqueio da conta é feito manualmente pela plataforma após o vencimento.
            </p>
          </div>
        </div>
      )}

      {billing.plan === "FREE" && (
        <Card className="border-zinc-700">
          <p className="text-sm text-zinc-400">
            Você está no plano gratuito. Para recursos avançados, fale com{" "}
            <a href={`mailto:${supportEmail}`} className="text-amber-400 hover:underline">
              {supportEmail}
            </a>
            .
          </p>
        </Card>
      )}

      {!billing.pixConfigured && billing.plan !== "FREE" && isOwner && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <p className="text-sm text-amber-300">
            Pagamento automático via PIX ainda não configurado pela plataforma. Entre em contato com{" "}
            {supportEmail}.
          </p>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Suas faturas</h2>
        </div>

        {billing.invoices.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">
            Nenhuma fatura gerada ainda. A cobrança mensal aparece aqui automaticamente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2 pr-4">Referência</th>
                  <th className="pb-2 pr-4">Plano</th>
                  <th className="pb-2 pr-4">Valor</th>
                  <th className="pb-2 pr-4">Vencimento</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {billing.invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    isOwner={isOwner}
                    pixConfigured={billing.pixConfigured}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function InvoiceRow({
  invoice,
  isOwner,
  pixConfigured,
}: {
  invoice: TenantInvoiceRow;
  isOwner: boolean;
  pixConfigured: boolean;
}) {
  const [openPay, setOpenPay] = useState(false);

  return (
    <>
      <tr className="border-b border-zinc-800/50">
        <td className="py-3 pr-4 text-zinc-400">
          {format(new Date(invoice.createdAt), "MMM/yyyy", { locale: ptBR })}
        </td>
        <td className="py-3 pr-4 text-white">{invoice.planLabel}</td>
        <td className="py-3 pr-4 text-amber-400">{formatCurrency(invoice.amount)}</td>
        <td className="py-3 pr-4 text-zinc-400">
          {format(new Date(invoice.dueDate), "dd/MM/yyyy", { locale: ptBR })}
        </td>
        <td className="py-3 pr-4">
          <StatusBadge invoice={invoice} />
        </td>
        <td className="py-3">
          {invoice.canPay && isOwner && pixConfigured && (
            <Button size="sm" onClick={() => setOpenPay(true)}>
              <CreditCard className="h-4 w-4" /> Pagar
            </Button>
          )}
          {invoice.tenantReportedPaidAt && invoice.status !== "PAID" && (
            <span className="text-xs text-blue-400">Aguardando confirmação</span>
          )}
          {invoice.status === "PAID" && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Pago
            </span>
          )}
        </td>
      </tr>

      {openPay && (
        <PayInvoiceModal paymentId={invoice.id} onClose={() => setOpenPay(false)} />
      )}
    </>
  );
}

function StatusBadge({ invoice }: { invoice: TenantInvoiceRow }) {
  const color =
    invoice.status === "PAID"
      ? "bg-green-500/20 text-green-400"
      : invoice.tenantReportedPaidAt
        ? "bg-blue-500/20 text-blue-400"
        : invoice.status === "OVERDUE"
          ? "bg-red-500/20 text-red-400"
          : "bg-amber-500/20 text-amber-400";

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
      {invoice.statusLabel}
    </span>
  );
}

function PayInvoiceModal({
  paymentId,
  onClose,
}: {
  paymentId: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"key" | "code" | null>(null);
  const [reported, setReported] = useState(false);
  const router = useRouter();
  const [pix, setPix] = useState<{
    amount: number;
    planLabel: string;
    dueDate: string;
    pixKey: string;
    merchantName: string;
    copiaECola: string;
  } | null>(null);

  useEffect(() => {
    getTenantPaymentPixPayload(paymentId)
      .then(setPix)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar PIX"))
      .finally(() => setLoading(false));
  }, [paymentId]);

  function copyText(text: string, type: "key" | "code") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleReportPaid() {
    startTransition(async () => {
      try {
        await reportTenantPayment(paymentId);
        setReported(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao confirmar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Pagar fatura com PIX</h2>
          <button onClick={onClose} className="text-zinc-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && <p className="text-sm text-zinc-400">Carregando dados do PIX...</p>}
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        {pix && !reported && (
          <div className="space-y-4">
            <div className="rounded-xl bg-zinc-900 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Plano</span>
                <span className="text-white">{pix.planLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Vencimento</span>
                <span className="text-white">
                  {format(new Date(pix.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-zinc-800 pt-2">
                <span className="text-zinc-400">Valor</span>
                <span className="text-lg font-bold text-amber-400">
                  {formatCurrency(pix.amount)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-zinc-500 mb-2">Recebedor: {pix.merchantName}</p>
              <label className="text-sm text-zinc-400">Chave PIX</label>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white break-all">
                  {pix.pixKey}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => copyText(pix.pixKey, "key")}
                >
                  <Copy className="h-4 w-4" />
                  {copied === "key" ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-400">PIX copia e cola</label>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-300 break-all max-h-24 overflow-y-auto">
                  {pix.copiaECola}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => copyText(pix.copiaECola, "code")}
                >
                  <Copy className="h-4 w-4" />
                  {copied === "code" ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>

            <ol className="text-sm text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Abra o app do seu banco</li>
              <li>Escolha pagar via PIX copia e cola</li>
              <li>Cole o código e confirme o valor</li>
              <li>Clique em &quot;Já paguei&quot; abaixo</li>
            </ol>

            <Button className="w-full" disabled={pending} onClick={handleReportPaid}>
              {pending ? "Enviando..." : "Já paguei — avisar plataforma"}
            </Button>
          </div>
        )}

        {reported && (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto" />
            <p className="text-white font-medium">Pagamento informado!</p>
            <p className="text-sm text-zinc-400">
              Vamos confirmar em breve. Sua conta continua ativa enquanto analisamos.
            </p>
            <Button onClick={onClose} variant="secondary">
              Fechar
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
