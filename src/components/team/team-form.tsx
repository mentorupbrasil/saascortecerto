"use client";

import { useState, useTransition, cloneElement, isValidElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useToast } from "@/components/ui/toast";
import { createTenantUser, updateTenantUser } from "@/lib/actions";
import { Plus, Pencil } from "lucide-react";
import type { UserRole } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
};

export function TeamUserForm({ tenantId, className }: { tenantId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createTenantUser(tenantId, formData);
        setOpen(false);
        toast.success("Usuário criado");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao criar usuário";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className={cn("min-h-[44px]", className)}>
        <Plus className="h-4 w-4" /> Novo usuário
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Novo usuário"
        mobileVariant="sheet"
        footer={
          <Button form="team-create-form" type="submit" className="w-full min-h-[44px]" disabled={pending}>
            {pending ? "Criando..." : "Criar usuário"}
          </Button>
        }
      >
        <form id="team-create-form" onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Nome" required />
          <Input name="email" label="Email" type="email" required />
          <Input name="password" label="Senha" type="password" required minLength={6} />
          <Select name="role" label="Função" required>
            <option value="BARBER">Barbeiro</option>
            <option value="RECEPTIONIST">Recepcionista</option>
            <option value="MANAGER">Gerente</option>
            <option value="OWNER">Dono</option>
          </Select>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function EditUserModal({
  member,
  isSelf,
  trigger,
  className,
}: {
  member: Member;
  isSelf?: boolean;
  trigger?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await updateTenantUser(member.id, formData);
        setOpen(false);
        toast.success("Usuário atualizado");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao salvar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <>
      {trigger && isValidElement(trigger) ? (
        cloneElement(
          trigger as React.ReactElement<{
            onClick?: (e: React.MouseEvent) => void;
            className?: string;
          }>,
          {
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
              setOpen(true);
            },
            className: cn((trigger.props as { className?: string }).className, className),
          }
        )
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-3 text-sm font-medium text-foreground hover:bg-accent",
            className
          )}
        >
          <Pencil className="h-4 w-4" /> Editar
        </button>
      )}

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Editar usuário"
        mobileVariant="sheet"
        footer={
          <Button form={`team-edit-${member.id}`} type="submit" className="w-full min-h-[44px]" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        }
      >
        <form id={`team-edit-${member.id}`} onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Nome" required defaultValue={member.name} />
          <Input
            name="email"
            label="Email"
            type="email"
            required
            defaultValue={member.email}
          />
          <Input
            name="password"
            label="Nova senha (deixe vazio para manter)"
            type="password"
            minLength={6}
            placeholder="••••••••"
          />
          <Select
            name="role"
            label="Função"
            required
            defaultValue={member.role}
            disabled={isSelf}
          >
            <option value="BARBER">Barbeiro</option>
            <option value="RECEPTIONIST">Recepcionista</option>
            <option value="MANAGER">Gerente</option>
            <option value="OWNER">Dono</option>
          </Select>
          {isSelf && (
            <p className="text-xs text-muted-foreground">Você não pode alterar sua própria função.</p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function TeamAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sizes = { sm: "h-10 w-10 text-sm", md: "h-12 w-12 text-base" };
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full bg-zinc-800 font-bold text-amber-400`}
    >
      {initials}
    </div>
  );
}
