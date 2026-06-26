"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createTenantUser, updateTenantUser } from "@/lib/actions";
import { Plus, X, Pencil } from "lucide-react";
import type { UserRole } from "@/lib/auth-utils";

type Member = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
};

export function TeamUserForm({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createTenantUser(tenantId, formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar usuário");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo usuário
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Novo usuário</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Criando..." : "Criar usuário"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

export function EditUserModal({
  member,
  isSelf,
}: {
  member: Member;
  isSelf?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await updateTenantUser(member.id, formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-amber-400 hover:underline"
      >
        <Pencil className="h-3 w-3" /> Editar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Editar usuário</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <p className="text-xs text-zinc-500">Você não pode alterar sua própria função.</p>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
