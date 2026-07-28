"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState, FixedActionBar } from "@/components/ui/page-chrome";
import {
  createMembershipPlan,
  subscribeClient,
  cancelMembership,
  toggleMembershipPlan,
} from "@/lib/membership-actions";
import { formatCurrency } from "@/lib/utils";
import { PLAN_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/constants/labels";
import { getMembershipRemaining, getMembershipStatusLabel } from "@/lib/membership";
import { Plus, Crown, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

const TABS = [
  { id: "planos", label: "Planos" },
  { id: "assinantes", label: "Assinantes" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ClubePanel({
  plans,
  memberships,
  clients,
}: {
  plans: Plan[];
  memberships: Membership[];
  clients: ClientOption[];
}) {
  const [tab, setTab] = useState<TabId>("planos");
  const activePlans = plans.filter((p) => p.active);

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="py-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Membros ativos</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{memberships.length}</p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Planos ativos</p>
          <p className="text-2xl font-bold text-white mt-1">{activePlans.length}</p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Clientes elegíveis</p>
          <p className="text-2xl font-bold text-white mt-1">{clients.length}</p>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
              tab === t.id
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                : "bg-zinc-800 text-zinc-400 hover:text-white border border-transparent"
            )}
          >
            {t.label}
            {t.id === "assinantes" && memberships.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs">
                {memberships.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "planos" && <PlansTab plans={plans} />}
      {tab === "assinantes" && (
        <AssinantesTab
          plans={plans}
          memberships={memberships}
          clients={clients}
        />
      )}

      <div className="lg:hidden">
        <FixedActionBar>
          {tab === "planos" ? (
            <MembershipPlanForm />
          ) : (
            <SubscribeClientForm plans={plans} clients={clients} fullWidth />
          )}
        </FixedActionBar>
      </div>

      <div className="hidden lg:flex gap-2 justify-end">
        <SubscribeClientForm plans={plans} clients={clients} />
        <MembershipPlanForm />
      </div>
    </div>
  );
}

function PlansTab({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <EmptyState
        title="Nenhum plano criado"
        description="Crie seu primeiro plano: mensal com X cortes, ilimitado, pacote ou fidelidade."
        icon={<Crown className="h-8 w-8" />}
        action={<MembershipPlanForm />}
      />
    );
  }

  return <PlansList plans={plans} />;
}

function AssinantesTab({
  plans,
  memberships,
  clients,
}: {
  plans: Plan[];
  memberships: Membership[];
  clients: ClientOption[];
}) {
  if (memberships.length === 0) {
    return (
      <EmptyState
        title="Nenhum assinante"
        description="Inscreva clientes nos planos do clube para começar."
        icon={<Crown className="h-8 w-8" />}
        action={
          plans.some((p) => p.active) ? (
            <SubscribeClientForm plans={plans} clients={clients} />
          ) : undefined
        }
      />
    );
  }

  return <MembershipsList memberships={memberships} />;
}

function WeekdayChips({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
}) {
  function toggle(day: number) {
    onChange(
      selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day].sort((a, b) => a - b)
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-zinc-300 mb-2">Dias permitidos</p>
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_LABELS.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              "min-h-[44px] min-w-[44px] rounded-xl border px-3 text-sm font-medium transition-colors",
              selected.includes(i)
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-border text-zinc-400 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanSummary({
  name,
  price,
  billingCycle,
  planType,
  maxVisitsPerMonth,
  totalVisits,
  bonusAfterVisits,
  bonusDescription,
  weekdays,
}: {
  name: string;
  price: string;
  billingCycle: string;
  planType: string;
  maxVisitsPerMonth: string;
  totalVisits: string;
  bonusAfterVisits: string;
  bonusDescription: string;
  weekdays: number[];
}) {
  const weekdayStr = weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ");

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <p className="text-sm font-medium text-amber-300 mb-2">Resumo do plano</p>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Nome</dt>
          <dd className="text-white font-medium">{name || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Valor</dt>
          <dd className="text-white">
            {price ? formatCurrency(Number(price)) : "—"}
            {billingCycle === "MONTHLY" ? "/mês" : " único"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Tipo</dt>
          <dd className="text-white">{PLAN_TYPE_LABELS[planType] ?? planType}</dd>
        </div>
        {planType === "MONTHLY_LIMITED" && maxVisitsPerMonth && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Cortes/mês</dt>
            <dd className="text-white">{maxVisitsPerMonth}</dd>
          </div>
        )}
        {planType === "VISIT_PACK" && totalVisits && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Visitas</dt>
            <dd className="text-white">{totalVisits}</dd>
          </div>
        )}
        {planType === "LOYALTY" && bonusAfterVisits && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Bônus</dt>
            <dd className="text-white">
              A cada {bonusAfterVisits} cortes
              {bonusDescription ? `: ${bonusDescription}` : ""}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Dias</dt>
          <dd className="text-white text-right">{weekdayStr || "—"}</dd>
        </div>
      </dl>
    </Card>
  );
}

export function MembershipPlanForm() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "summary">("form");
  const [planType, setPlanType] = useState("MONTHLY_LIMITED");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [formSnapshot, setFormSnapshot] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function resetForm() {
    setStep("form");
    setFormSnapshot({});
    setPlanType("MONTHLY_LIMITED");
    setWeekdays([1, 2, 3, 4, 5, 6]);
  }

  function handleReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const snapshot: Record<string, string> = {};
    new FormData(form).forEach((v, k) => {
      snapshot[k] = String(v);
    });
    setFormSnapshot(snapshot);
    setStep("summary");
  }

  function handleCreate() {
    const formData = new FormData();
    Object.entries(formSnapshot).forEach(([k, v]) => formData.set(k, v));
    formData.set("allowedWeekdays", weekdays.join(",") || "1,2,3,4,5,6");

    startTransition(async () => {
      try {
        await createMembershipPlan(formData);
        setOpen(false);
        resetForm();
        toast.success("Plano criado");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar plano");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="min-h-[44px] w-full lg:w-auto">
        <Plus className="h-4 w-4" /> Criar plano
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
        title={step === "form" ? "Novo plano do clube" : "Confirmar plano"}
        mobileVariant="full"
        footer={
          step === "form" ? (
            <Button
              form="plan-form"
              type="submit"
              className="w-full min-h-[44px]"
            >
              Revisar plano
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 min-h-[44px]"
                onClick={() => setStep("form")}
                disabled={pending}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1 min-h-[44px]"
                disabled={pending}
                onClick={handleCreate}
              >
                {pending ? "Criando..." : "Criar plano"}
              </Button>
            </div>
          )
        }
      >
        {step === "form" ? (
          <form id="plan-form" onSubmit={handleReview} className="space-y-4">
            <Input
              name="name"
              label="Nome do plano"
              required
              placeholder="Clube VIP"
              defaultValue={formSnapshot.name}
            />
            <Textarea
              name="description"
              label="Descrição"
              placeholder="2 cortes por mês..."
              defaultValue={formSnapshot.description}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                name="price"
                label="Valor (R$)"
                type="number"
                step="0.01"
                required
                defaultValue={formSnapshot.price}
              />
              <Select
                name="billingCycle"
                label="Cobrança"
                required
                defaultValue={formSnapshot.billingCycle ?? "MONTHLY"}
              >
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

            {planType === "MONTHLY_LIMITED" && (
              <Input
                name="maxVisitsPerMonth"
                label="Cortes por mês"
                type="number"
                min={1}
                required
                placeholder="4"
                defaultValue={formSnapshot.maxVisitsPerMonth}
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
                defaultValue={formSnapshot.totalVisits}
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
                  defaultValue={formSnapshot.bonusAfterVisits}
                />
                <Input
                  name="bonusDescription"
                  label="Descrição do bônus"
                  placeholder="Barba grátis"
                  defaultValue={formSnapshot.bonusDescription}
                />
              </>
            )}

            <WeekdayChips selected={weekdays} onChange={setWeekdays} />
          </form>
        ) : (
          <PlanSummary
            name={formSnapshot.name ?? ""}
            price={formSnapshot.price ?? ""}
            billingCycle={formSnapshot.billingCycle ?? "MONTHLY"}
            planType={planType}
            maxVisitsPerMonth={formSnapshot.maxVisitsPerMonth ?? ""}
            totalVisits={formSnapshot.totalVisits ?? ""}
            bonusAfterVisits={formSnapshot.bonusAfterVisits ?? ""}
            bonusDescription={formSnapshot.bonusDescription ?? ""}
            weekdays={weekdays}
          />
        )}
      </ResponsiveDialog>
    </>
  );
}

export function SubscribeClientForm({
  plans,
  clients,
  fullWidth,
}: {
  plans: Plan[];
  clients: ClientOption[];
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const activePlans = plans.filter((p) => p.active);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = search.replace(/\D/g, "");
    if (!q) return clients;
    return clients.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = digits.length > 0 && c.phone.replace(/\D/g, "").includes(digits);
      return nameMatch || phoneMatch;
    });
  }, [clients, search]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (selectedClientId) {
      formData.set("clientId", selectedClientId);
    }
    startTransition(async () => {
      try {
        await subscribeClient(formData);
        setOpen(false);
        setSearch("");
        setSelectedClientId("");
        toast.success("Cliente inscrito no clube");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao inscrever");
      }
    });
  }

  if (activePlans.length === 0) return null;

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        className={cn("min-h-[44px]", fullWidth && "w-full")}
      >
        <Crown className="h-4 w-4" /> Inscrever cliente
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Inscrever no clube"
        mobileVariant="full"
        footer={
          <Button
            form="subscribe-form"
            type="submit"
            className="w-full min-h-[44px]"
            disabled={pending || !selectedClientId}
          >
            {pending ? "Inscrevendo..." : "Confirmar inscrição"}
          </Button>
        }
      >
        <form id="subscribe-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="search"
              placeholder="Buscar cliente por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-border bg-input pl-10 pr-3 text-sm text-foreground"
            />
          </div>

          <input type="hidden" name="clientId" value={selectedClientId} />

          <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border p-1">
            {filteredClients.length === 0 && (
              <p className="py-4 text-center text-sm text-zinc-500">Nenhum cliente encontrado</p>
            )}
            {filteredClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClientId(c.id)}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-3 min-h-[44px] text-sm transition-colors",
                  selectedClientId === c.id
                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                    : "text-zinc-300 hover:bg-zinc-800"
                )}
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-zinc-500 ml-2">{c.phone}</span>
              </button>
            ))}
          </div>

          <Select name="planId" label="Plano" required>
            <option value="">Selecione...</option>
            {activePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(Number(p.price))}
              </option>
            ))}
          </Select>
          <Input name="notes" label="Observações" />
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function PlansList({ plans }: { plans: Plan[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plans.map((plan) => (
        <Card key={plan.id} className={!plan.active ? "opacity-50" : "border-amber-500/20"}>
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="font-semibold text-white truncate">{plan.name}</p>
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
            <Button
              size="sm"
              variant={plan.active ? "secondary" : "ghost"}
              disabled={pending}
              className="min-h-[44px] shrink-0"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await toggleMembershipPlan(plan.id, !plan.active);
                    toast.success(plan.active ? "Plano desativado" : "Plano ativado");
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erro");
                  }
                })
              }
            >
              {plan.active ? "Ativo" : "Inativo"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function MembershipsList({ memberships }: { memberships: Membership[] }) {
  const [pending, startTransition] = useTransition();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const cancelTarget = memberships.find((m) => m.id === cancelId);

  return (
    <>
      <div className="space-y-3">
        {memberships.map((m) => (
          <Card key={m.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {m.client.photoUrl ? (
                  <img
                    src={m.client.photoUrl}
                    alt={m.client.name}
                    className="h-12 w-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center text-amber-400 font-bold shrink-0">
                    {m.client.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{m.client.name}</p>
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
              <Button
                variant="ghost"
                disabled={pending}
                className="min-h-[44px] text-red-400 shrink-0"
                onClick={() => setCancelId(m.id)}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(v) => !v && setCancelId(null)}
        title="Cancelar assinatura?"
        description={
          cancelTarget
            ? `Cancelar a assinatura de ${cancelTarget.client.name} no plano ${cancelTarget.plan.name}?`
            : "Cancelar assinatura deste cliente?"
        }
        confirmLabel="Cancelar assinatura"
        tone="danger"
        loading={pending}
        onConfirm={() => {
          if (!cancelId) return;
          startTransition(async () => {
            try {
              await cancelMembership(cancelId);
              toast.success("Assinatura cancelada");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erro ao cancelar");
            }
          });
        }}
      />
    </>
  );
}
