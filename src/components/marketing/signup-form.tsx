"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createSignupCheckout } from "@/lib/signup-actions";
import { formatPlanPrice, PLAN_LABELS, PLAN_WHATSAPP_DESCRIPTION } from "@/lib/plan-pricing";
import { SiteHeader } from "@/components/marketing/site-header";
import { Logo } from "@/components/brand/logo";
import { Shield } from "lucide-react";

export function SignupPageClient({ defaultPlan }: { defaultPlan: "PRO" | "CLUBE" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

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
    <div className="min-h-screen bg-zinc-950">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-12 lg:px-8">
        <div className="mb-8 text-center">
          <Logo variant="compact" href="/" className="mx-auto h-10 mb-4" />
          <h1 className="text-2xl font-bold text-white">Criar sua barbearia</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Preencha os dados, escolha o plano e pague. Sua conta é liberada automaticamente.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select name="plan" label="Plano" defaultValue={defaultPlan} required>
              <option value="PRO">
                {PLAN_LABELS.PRO} — {formatPlanPrice("PRO")}/mês ({PLAN_WHATSAPP_DESCRIPTION.PRO})
              </option>
              <option value="CLUBE">
                {PLAN_LABELS.CLUBE} — {formatPlanPrice("CLUBE")}/mês ({PLAN_WHATSAPP_DESCRIPTION.CLUBE})
              </option>
            </Select>

            <Input
              name="barbershopName"
              label="Nome da barbearia"
              required
              placeholder="Barbearia do João"
            />
            <Input name="ownerName" label="Seu nome" required placeholder="João Silva" />
            <Input
              name="ownerEmail"
              label="Seu e-mail (será seu login)"
              type="email"
              required
              placeholder="joao@email.com"
            />
            <Input
              name="ownerPassword"
              label="Senha"
              type="password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
            />
            <Input name="phone" label="WhatsApp / telefone" placeholder="(11) 99999-9999" />

            <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex gap-3">
              <Shield className="h-5 w-5 text-green-400 shrink-0" />
              <p className="text-xs text-zinc-400">
                Sua barbearia terá um ambiente <strong className="text-zinc-300">100% isolado</strong>.
                Outras barbearias no CorteCerto não veem seus dados.
              </p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={pending}>
              {pending ? "Processando..." : "Continuar para pagamento"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-zinc-500 mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-amber-400 hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
