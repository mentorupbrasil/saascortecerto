"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { toggleUserActive } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function ToggleUserButton({
  userId,
  active,
  name,
}: {
  userId: string;
  active: boolean;
  name: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function runToggle() {
    startTransition(async () => {
      try {
        await toggleUserActive(userId, !active);
        toast.success(active ? "Usuário desativado" : "Usuário ativado");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao alterar status");
      }
    });
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmOpen(true);
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className={cn(
          "inline-flex min-h-[44px] items-center rounded-full px-3 text-xs font-semibold uppercase tracking-wide",
          active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
        )}
      >
        {active ? "Ativo" : "Inativo"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={active ? "Desativar usuário?" : "Ativar usuário?"}
        description={
          active
            ? `"${name}" perderá acesso ao sistema até ser reativado.`
            : `"${name}" voltará a acessar o sistema com a função atual.`
        }
        confirmLabel={active ? "Desativar" : "Ativar"}
        tone={active ? "danger" : "default"}
        loading={pending}
        onConfirm={runToggle}
      />
    </>
  );
}
