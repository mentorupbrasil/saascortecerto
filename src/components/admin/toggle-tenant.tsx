"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleTenantActive } from "@/lib/actions";

export function ToggleTenantButton({
  tenantId,
  active,
}: {
  tenantId: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleTenantActive(tenantId, !active);
          router.refresh();
        })
      }
      className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
        active
          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
          : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
      }`}
    >
      {active ? "Desativar" : "Ativar"}
    </button>
  );
}
