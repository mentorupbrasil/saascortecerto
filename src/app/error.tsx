"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="max-w-md rounded-2xl border border-red-500/30 bg-zinc-900 p-6 text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <h1 className="text-xl font-bold text-white mb-2">Algo deu errado</h1>
        <p className="text-sm text-zinc-400 mb-4">
          Erro no servidor. Verifique se o banco Neon está sincronizado e as variáveis
          de ambiente na Vercel.
        </p>
        <p className="text-xs text-zinc-600 mb-4 font-mono break-all">
          {error.message || error.digest}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-black"
          >
            Tentar de novo
          </button>
          <a
            href="/api/health"
            target="_blank"
            className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-300"
          >
            Ver diagnóstico
          </a>
        </div>
      </div>
    </div>
  );
}
