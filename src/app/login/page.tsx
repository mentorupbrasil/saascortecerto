"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    <div className="flex min-h-screen flex-col bg-zinc-950 px-4">
      <div className="flex justify-end p-4 gap-3">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← Voltar ao site
        </Link>
        <Link href="/assinar">
          <Button size="sm">Assinar</Button>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center pb-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 text-center">
            <Link href="/">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-3xl">
                ✂️
              </div>
            </Link>
            <h1 className="text-3xl font-bold text-white">CorteCerto</h1>
            <p className="mt-2 text-zinc-400">Área do cliente</p>
          </div>

          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
              <Input
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

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

          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-500">
            <p className="font-medium text-zinc-400 mb-2">Contas demo:</p>
            <p>Admin: admin@cortecerto.com / admin123</p>
            <p>Barbearia: joao@barbearia.com / barbearia123</p>
            <p>Barbeiro: carlos@barbearia.com / barbeiro123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
