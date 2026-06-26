"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleUserActive } from "@/lib/actions";

export function ToggleUserButton({ userId, active }: { userId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleUserActive(userId, !active);
          router.refresh();
        })
      }
      className={`rounded-lg px-3 py-1 text-xs font-medium ${
        active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
    </button>
  );
}
