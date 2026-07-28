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
    // Only the digest is logged client-side — never the message/stack, which
    // may contain internal details. Full details are captured server-side.
    console.error("client_error_boundary", error.digest);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="max-w-md rounded-2xl border border-red-500/30 bg-zinc-900 p-6 text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <h1 className="text-xl font-bold text-foreground mb-2">Algo deu errado</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Não foi possível concluir esta operação. Tente novamente. Se o problema continuar,
          entre em contato com o suporte.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-black"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    </div>
  );
}
