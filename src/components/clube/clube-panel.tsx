"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  createMembershipPlan,
  subscribeClient,
  cancelMembership,
  toggleMembershipPlan,
} from "@/lib/membership-actions";
import { formatCurrency } from "@/lib/utils";
import { PLAN_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/whatsapp";
import { getMembershipRemaining, getMembershipStatusLabel } from "@/lib/membership";
import { Plus, X, Crown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number | { toString(): string };
  billingCycle: string;
  planType: string;
  maxVisitsPerMonth: number | null;
  totalVisits: number | null;
  allowedWeekdays: string;
  bonusAfterVisits: number | null;
  bonusDescription: string | null;
  active: boolean;
  _count?: { memberships: number };
};

type Membership = {
  id: string;
  status: string;
  startedAt: string;
  expiresAt: string | null;
  visitsUsedThisPeriod: number;
  totalVisitsUsed: number;
  bonusEarned: number;
  client: { id: string; name: string; phone: string; photoUrl: string | null };
  plan: Plan;
};

type ClientOption = { id: string; name: string; phone: string };

export function MembershipPlanForm() {
  const [open, setOpen] = useState(false);
  const [planType, setPlanType] = useState("MONTHLY_LIMITED");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const checked = form.querySelectorAll<HTMLInputElement>('input[name="weekday"]:checked');
    const days = Array.from(checked).map((el) => el.value).join(",");
    formData.set("allowedWeekdays", days || "1,2,3,4,5,6");

    startTransition(async () => {
      await createMembershipPlan(formData);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Criar plano
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <Card className="w-full max-w-lg my-8 animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Novo plano do clube</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input name="name" label="Nome do plano" required placeholder="Clube VIP" />
              <Textarea name="description" label="Descrição" placeholder="2 cortes por mês..." />

              <div className="grid grid-cols-2 gap-3">
                <Input name="price" label="Valor (R$)" type="number" step="0.01" required />
                <Select name="billingCycle" label="Cobrança" required defaultValue="MONTHLY">
                  <option value="MONTHLY">Mensal</option>
                  <option value="ONE_TIME">Pagamento único</option>
                </Select>
              </div>

              <Select
                name="planType"
                label="Tipo de plano"
                required
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
              >
                {Object.entries(PLAN_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>

              {(planType === "MONTHLY_LIMITED") && (
                <Input
                  name="maxVisitsPerMonth"
                  label="Cortes por mês"
                  type="number"
                  min={1}
                  required
                  placeholder="4"
                />
              )}

              {planType === "VISIT_PACK" && (
                <Input
                  name="totalVisits"
                  label="Total de visitas no pacote"
                  type="number"
                  min={1}
                  required
                  placeholder="10"
                />
              )}

              {planType === "LOYALTY" && (
                <>
                  <Input
                    name="bonusAfterVisits"
                    label="Bônus após quantos cortes?"
                    type="number"
                    min={2}
                    required
                    placeholder="5"
                  />
                  <Input
                    name="bonusDescription"
                    label="Descrição do bônus"
                    placeholder="Barba grátis"
                  />
                </>
              )}

              <div>
                <p className="text-sm font-medium text-zinc-300 mb-2">Dias permitidos</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, i) => (
                    <label key={i} className="flex items-center gap-1 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        name="weekday"
                        value={i}
                        defaultChecked={i >= 1 && i <= 6}
                        className="accent-amber-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Criando..." : "Criar plano"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

export function SubscribeClientForm({
  plans,
  clients,
}: {
  plans: Plan[];
  clients: ClientOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const activePlans = plans.filter((p) => p.active);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await subscribeClient(formData);
      setOpen(false);
      router.refresh();
    });
  }

  if (activePlans.length === 0) return null;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Crown className="h-4 w-4" /> Inscrever cliente
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Inscrever no clube</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select name="clientId" label="Cliente" required>
                <option value="">Selecione...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </Select>
              <Select name="planId" label="Plano" required>
                <option value="">Selecione...</option>
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(Number(p.price))}
                  </option>
                ))}
              </Select>
              <Input name="notes" label="Observações" />
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Inscrevendo..." : "Confirmar inscrição"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

export function PlansList({ plans }: { plans: Plan[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plans.map((plan) => (
        <Card key={plan.id} className={!plan.active ? "opacity-50" : "border-amber-500/20"}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-400" />
                <p className="font-semibold text-white">{plan.name}</p>
              </div>
              <p className="text-xl font-bold text-amber-400 mt-1">
                {formatCurrency(Number(plan.price))}
                <span className="text-xs text-zinc-500 font-normal ml-1">
                  /{plan.billingCycle === "MONTHLY" ? "mês" : "único"}
                </span>
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {PLAN_TYPE_LABELS[plan.planType]}
              </p>
              {plan.description && (
                <p className="text-sm text-zinc-400 mt-2">{plan.description}</p>
              )}
              {plan.maxVisitsPerMonth && (
                <p className="text-xs text-zinc-500 mt-1">
                  {plan.maxVisitsPerMonth} cortes/mês
                </p>
              )}
              {plan.totalVisits && (
                <p className="text-xs text-zinc-500 mt-1">{plan.totalVisits} visitas</p>
              )}
              {plan.bonusAfterVisits && (
                <p className="text-xs text-green-400 mt-1">
                  🎁 A cada {plan.bonusAfterVisits} cortes: {plan.bonusDescription}
                </p>
              )}
              <p className="text-xs text-zinc-600 mt-2">
                {plan._count?.memberships ?? 0} inscritos ativos
              </p>
            </div>
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await toggleMembershipPlan(plan.id, !plan.active);
                  router.refresh();
                })
              }
              className={`text-xs px-2 py-1 rounded-lg ${
                plan.active ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {plan.active ? "Ativo" : "Inativo"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function MembershipsList({ memberships }: { memberships: Membership[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (memberships.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-zinc-500">Nenhum cliente inscrito ainda</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {memberships.map((m) => (
        <Card key={m.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {m.client.photoUrl ? (
                <img
                  src={m.client.photoUrl}
                  alt={m.client.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center text-amber-400 font-bold">
                  {m.client.name.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-semibold text-white">{m.client.name}</p>
                <p className="text-sm text-amber-400">{m.plan.name}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {getMembershipRemaining(
                    {
                      visitsUsedThisPeriod: m.visitsUsedThisPeriod,
                      totalVisitsUsed: m.totalVisitsUsed,
                      bonusEarned: m.bonusEarned,
                    },
                    {
                      planType: m.plan.planType,
                      maxVisitsPerMonth: m.plan.maxVisitsPerMonth,
                      totalVisits: m.plan.totalVisits,
                      bonusAfterVisits: m.plan.bonusAfterVisits,
                    }
                  )}{" "}
                  · {getMembershipStatusLabel(m.status)}
                </p>
                {m.expiresAt && (
                  <p className="text-xs text-zinc-600">
                    Vence: {format(new Date(m.expiresAt), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
                {m.bonusEarned > 0 && (
                  <p className="text-xs text-green-400">🎁 {m.bonusEarned} bônus ganhos</p>
                )}
              </div>
            </div>
            <button
              disabled={pending}
              onClick={() => {
                if (confirm("Cancelar assinatura deste cliente?")) {
                  startTransition(async () => {
                    await cancelMembership(m.id);
                    router.refresh();
                  });
                }
              }}
              className="text-xs text-red-400 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
