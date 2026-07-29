"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createSignupCheckout } from "@/lib/signup-actions";
import {
  formatMoneyBRL,
  formatPlanPrice,
  getPlanCheckoutAmount,
  PLAN_LABELS,
  PLAN_WHATSAPP_DESCRIPTION,
  type PlanBilling,
} from "@/lib/plan-pricing";
import { SiteHeader } from "@/components/marketing/site-header";
import { maskBrazilianPhone } from "@/lib/client-utils";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import { ChevronLeft, Eye, EyeOff, Shield, Check } from "lucide-react";

const STEPS = [
  { id: 1, label: "Plano" },
  { id: 2, label: "Barbearia" },
  { id: 3, label: "Responsável" },
  { id: 4, label: "Revisão" },
  { id: 5, label: "Pagamento" },
] as const;

type Plan = "PRO" | "CLUBE";

export function SignupPageClient({
  defaultPlan,
  defaultBilling = "monthly",
}: {
  defaultPlan: Plan;
  defaultBilling?: PlanBilling;
}) {
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  const [plan, setPlan] = useState<Plan>(defaultPlan);
  const [billing, setBilling] = useState<PlanBilling>(defaultBilling);
  const [barbershopName, setBarbershopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  function clearError() {
    if (error) setError("");
  }

  function validateStep(current: number): string | null {
    if (current === 2 && barbershopName.trim().length < 2) {
      return "Informe o nome da barbearia";
    }
    if (current === 3) {
      if (ownerName.trim().length < 2) return "Informe seu nome";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
        return "Informe um e-mail válido";
      }
      if (ownerPassword.length < 6) return "Senha com no mínimo 6 caracteres";
    }
    if (current === 4 && !acceptedTerms) {
      return "Aceite os termos para continuar";
    }
    return null;
  }

  function goNext() {
    clearError();
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length));
  }

  function goBack() {
    clearError();
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleSubmit() {
    clearError();
    const msg = validateStep(4);
    if (msg) {
      setError(msg);
      setStep(4);
      return;
    }

    const formData = new FormData();
    formData.set("plan", plan);
    formData.set("billing", billing);
    formData.set("barbershopName", barbershopName.trim());
    formData.set("ownerName", ownerName.trim());
    formData.set("ownerEmail", ownerEmail.trim());
    formData.set("ownerPassword", ownerPassword);
    if (phone.trim()) formData.set("phone", phone.replace(/\D/g, ""));

    startTransition(async () => {
      try {
        const result = await createSignupCheckout(formData);

        if (result.mercadoPagoUrl) {
          window.location.href = result.mercadoPagoUrl;
          return;
        }

        if (result.demoActivated) {
          router.push(`/assinar/sucesso?checkout=${result.checkoutId}`);
          return;
        }

        router.push(`/assinar/${result.checkoutId}/pagamento`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar cadastro");
      }
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-lg flex-1 flex flex-col px-4 py-8 lg:px-8 pb-28">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">Criar sua barbearia</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Passo {step} de {STEPS.length} · {STEPS[step - 1].label}
          </p>
        </div>

        <div className="mb-6 flex gap-1">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                s.id <= step ? "bg-amber-500" : "bg-zinc-800"
              )}
              aria-hidden
            />
          ))}
        </div>

        <Card className="flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Escolha o plano ideal para sua barbearia.</p>

              <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <span
                  className={cn(
                    "text-sm font-medium",
                    billing === "monthly" ? "text-foreground" : "text-zinc-500"
                  )}
                >
                  Mensal
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={billing === "yearly"}
                  aria-label="Alternar cobrança anual"
                  onClick={() => {
                    setBilling(billing === "yearly" ? "monthly" : "yearly");
                    clearError();
                  }}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                    billing === "yearly" ? "bg-amber-500" : "bg-zinc-700"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform",
                      billing === "yearly" ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    billing === "yearly" ? "text-foreground" : "text-zinc-500"
                  )}
                >
                  Anual <span className="text-amber-400">(−20%)</span>
                </span>
              </div>

              {(["PRO", "CLUBE"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPlan(p);
                    clearError();
                  }}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors min-h-[72px]",
                    plan === p
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{PLAN_LABELS[p]}</p>
                      <p className="text-sm text-amber-400 mt-0.5">
                        {formatPlanPrice(p, billing)}/mês
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {billing === "yearly"
                          ? `${formatMoneyBRL(getPlanCheckoutAmount(p, "yearly"))}/ano · ${PLAN_WHATSAPP_DESCRIPTION[p]}`
                          : PLAN_WHATSAPP_DESCRIPTION[p]}
                      </p>
                    </div>
                    {plan === p && <Check className="h-5 w-5 text-amber-400 shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Como sua barbearia aparece para os clientes.</p>
              <Input
                label="Nome da barbearia"
                value={barbershopName}
                onChange={(e) => {
                  setBarbershopName(e.target.value);
                  clearError();
                }}
                required
                placeholder="Barbearia do João"
                autoFocus
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Input
                label="Seu nome"
                value={ownerName}
                onChange={(e) => {
                  setOwnerName(e.target.value);
                  clearError();
                }}
                required
                placeholder="João Silva"
                autoFocus
              />
              <Input
                label="Seu e-mail (será seu login)"
                type="email"
                autoComplete="email"
                value={ownerEmail}
                onChange={(e) => {
                  setOwnerEmail(e.target.value);
                  clearError();
                }}
                required
                placeholder="joao@email.com"
              />
              <div className="space-y-1.5">
                <label htmlFor="owner-password" className="block text-sm font-medium text-muted-foreground">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="owner-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={ownerPassword}
                    onChange={(e) => {
                      setOwnerPassword(e.target.value);
                      clearError();
                    }}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-border bg-input px-4 py-2.5 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 hover:text-zinc-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Input
                label="WhatsApp / telefone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(maskBrazilianPhone(e.target.value))}
                placeholder="(11) 99999-9999"
              />
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex gap-3">
                <Shield className="h-5 w-5 text-green-400 shrink-0" />
                <p className="text-xs text-zinc-400">
                  Sua barbearia terá um ambiente{" "}
                  <strong className="text-zinc-300">100% isolado</strong>. Outras barbearias no{" "}
                  {brand.name} não veem seus dados.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Plano</span>
                  <span className="text-foreground font-medium">
                    {PLAN_LABELS[plan]}
                    {billing === "yearly" ? " · anual" : " · mensal"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Valor</span>
                  <span className="text-amber-400 font-medium">
                    {billing === "yearly"
                      ? `${formatMoneyBRL(getPlanCheckoutAmount(plan, "yearly"))}/ano`
                      : `${formatPlanPrice(plan)}/mês`}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Barbearia</span>
                  <span className="text-foreground text-right">{barbershopName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Responsável</span>
                  <span className="text-foreground text-right">{ownerName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">E-mail</span>
                  <span className="text-foreground text-right break-all">{ownerEmail}</span>
                </div>
                {phone && (
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Telefone</span>
                    <span className="text-foreground">{phone}</span>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked);
                    clearError();
                  }}
                  className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-zinc-400">
                  Li e aceito os termos de uso e a cobrança{" "}
                  {billing === "yearly" ? "anual" : "mensal"} do plano escolhido.
                </span>
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                <p className="text-sm font-medium text-foreground mb-2">Resumo do pedido</p>
                <p className="text-2xl font-bold text-amber-400">
                  {billing === "yearly"
                    ? formatMoneyBRL(getPlanCheckoutAmount(plan, "yearly"))
                    : formatPlanPrice(plan)}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {PLAN_LABELS[plan]}
                  {billing === "yearly" ? " · anual (−20%)" : " · mensal"} · {barbershopName}
                </p>
                {billing === "yearly" && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Equivale a {formatPlanPrice(plan, "yearly")}/mês
                  </p>
                )}
              </div>
              <p className="text-sm text-zinc-400">
                Na próxima tela você conclui o pagamento via PIX ou cartão. Sua conta é liberada
                automaticamente após a confirmação.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 mt-4">{error}</p>
          )}
        </Card>

        <p className="text-center text-sm text-zinc-500 mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-amber-400 hover:underline">
            Fazer login
          </Link>
        </p>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg gap-2">
          {step > 1 && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="min-h-[48px] shrink-0"
              onClick={goBack}
              disabled={pending}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          {step < 5 ? (
            <Button type="button" size="lg" className="flex-1 min-h-[48px]" onClick={goNext}>
              Continuar
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="flex-1 min-h-[48px]"
              disabled={pending}
              onClick={handleSubmit}
            >
              {pending ? "Processando..." : "Continuar para pagamento"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
