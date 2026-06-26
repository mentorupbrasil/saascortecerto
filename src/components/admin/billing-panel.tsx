"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  updateTenantPlan,
  recordSubscriptionPayment,
  markPaymentPaid,
  generateMonthlyInvoices,
} from "@/lib/admin-actions";
import { formatPlanPrice, PLAN_LABELS, getPlanPrice } from "@/lib/plan-pricing";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, X, Plus } from "lucide-react";

type TenantRow = {
  id: string;
  name: string;
  plan: "FREE" | "PRO" | "CLUBE";
  active: boolean;
  ownerEmail: string | null;
};

type PaymentRow = {
  id: string;
  tenantName: string;
  plan: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  tenantReportedPaidAt: string | null;
  createdAt: string;
};

export function AdminBillingPanel({
  mrr,
  revenueThisMonth,
  pendingCount,
  pendingAmount,
  tenants,
  payments,
}: {
  mrr: number;
  revenueThisMonth: number;
  pendingCount: number;
  pendingAmount: number;
  tenants: TenantRow[];
  payments: PaymentRow[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-500/20 bg-green-500/5">
          <p className="text-sm text-zinc-400">MRR (recorrente)</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(mrr)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Recebido este mês</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(revenueThisMonth)}</p>
        </Card>
        <Card className="border-amber-500/20">
          <p className="text-sm text-zinc-400">Pendente ({pendingCount})</p>
          <p className="text-2xl font-bold text-amber-400">{formatCurrency(pendingAmount)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Barbearias pagantes</p>
          <p className="text-2xl font-bold text-white">
            {tenants.filter((t) => t.active && t.plan !== "FREE").length}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await generateMonthlyInvoices();
              router.refresh();
            })
          }
        >
          Gerar cobranças do mês
        </Button>
        <RecordPaymentModal tenants={tenants} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Planos das barbearias</h2>
        <div className="space-y-2">
          {tenants.map((tenant) => (
            <TenantPlanRow key={tenant.id} tenant={tenant} />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-400" />
          Histórico de pagamentos
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 pr-4">Barbearia</th>
                <th className="pb-2 pr-4">Plano</th>
                <th className="pb-2 pr-4">Valor</th>
                <th className="pb-2 pr-4">Vencimento</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-600">
                    Nenhum pagamento registrado
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 text-white">{p.tenantName}</td>
                  <td className="py-2 pr-4 text-zinc-400">{p.plan}</td>
                  <td className="py-2 pr-4 text-amber-400">{formatCurrency(p.amount)}</td>
                  <td className="py-2 pr-4 text-zinc-400">
                    {format(new Date(p.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        p.status === "PAID"
                          ? "bg-green-500/20 text-green-400"
                          : p.tenantReportedPaidAt
                            ? "bg-blue-500/20 text-blue-400"
                            : p.status === "OVERDUE"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {p.tenantReportedPaidAt && p.status !== "PAID"
                        ? "Aguardando confirmação"
                        : p.status}
                    </span>
                  </td>
                  <td className="py-2">
                    {p.status !== "PAID" && (
                      <button
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await markPaymentPaid(p.id);
                            router.refresh();
                          })
                        }
                        className="text-xs text-green-400 hover:underline"
                      >
                        Marcar pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TenantPlanRow({ tenant }: { tenant: TenantRow }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateTenantPlan(formData);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-zinc-900 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-white">{tenant.name}</p>
        <p className="text-xs text-zinc-500">{tenant.ownerEmail ?? "—"}</p>
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <Select name="plan" defaultValue={tenant.plan}>
          <option value="FREE">{PLAN_LABELS.FREE}</option>
          <option value="PRO">{PLAN_LABELS.PRO} — {formatPlanPrice("PRO")}/mês (manual)</option>
          <option value="CLUBE">{PLAN_LABELS.CLUBE} — {formatPlanPrice("CLUBE")}/mês (automático)</option>
        </Select>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Salvar
        </Button>
      </form>
    </div>
  );
}

function RecordPaymentModal({ tenants }: { tenants: TenantRow[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const payingTenants = tenants.filter((t) => t.plan !== "FREE");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await recordSubscriptionPayment(formData);
      setOpen(false);
      router.refresh();
    });
  }

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Registrar pagamento
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Registrar pagamento</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select name="tenantId" label="Barbearia" required>
                <option value="">Selecione...</option>
                {payingTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.plan}
                  </option>
                ))}
              </Select>
              <Select name="plan" label="Plano" required defaultValue="PRO">
                <option value="PRO">{PLAN_LABELS.PRO} — {formatPlanPrice("PRO")}/mês (manual)</option>
                <option value="CLUBE">{PLAN_LABELS.CLUBE} — {formatPlanPrice("CLUBE")}/mês (automático)</option>
              </Select>
              <Input
                name="amount"
                label="Valor (R$)"
                type="number"
                step="0.01"
                defaultValue={String(getPlanPrice("PRO"))}
                required
              />
              <Input name="dueDate" label="Vencimento" type="date" defaultValue={today} required />
              <Select name="status" label="Status" defaultValue="PAID">
                <option value="PAID">Pago</option>
                <option value="PENDING">Pendente</option>
                <option value="OVERDUE">Atrasado</option>
              </Select>
              <Input name="notes" label="Observações" placeholder="PIX, transferência..." />
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Salvando..." : "Registrar"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
