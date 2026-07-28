"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/brand/brand-mark";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function clearError() {
    if (error) setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou senha incorretos");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 px-4 overflow-x-hidden safe-bottom">
      <div className="flex flex-wrap justify-end items-center gap-2 sm:gap-3 p-3 sm:p-4 safe-top">
        <Link href="/" className="text-sm text-zinc-400 hover:text-foreground py-2">
          ← Voltar ao site
        </Link>
        <Link href="/assinar">
          <Button size="sm" className="min-h-[44px]">
            Assinar
          </Button>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center pb-8 sm:pb-12 px-1">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-6 sm:mb-8 text-center">
            <Link href="/" className="inline-flex">
              <BrandMark className="mx-auto mb-4 h-14 w-14 sm:h-16 sm:w-16" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">CorteCerto</h1>
            <p className="mt-2 text-zinc-400">Área do cliente</p>
          </div>

          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                placeholder="seu@email.com"
                required
              />

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-muted-foreground">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError();
                    }}
                    placeholder="••••••••"
                    required
                    className={cn(
                      "w-full rounded-xl border border-border bg-input px-4 py-2.5 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg p-2 text-zinc-500 hover:text-zinc-300"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <p className="text-right text-xs text-zinc-600">Esqueci minha senha — Em breve</p>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </Card>

          <p className="text-center text-sm text-zinc-500 mt-4">
            Não tem conta?{" "}
            <Link href="/assinar" className="text-amber-400 hover:underline">
              Assinar agora
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
