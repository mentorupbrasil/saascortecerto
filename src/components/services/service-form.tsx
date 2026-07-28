"use client";

import { useState, useTransition, cloneElement, isValidElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { createService, updateService, toggleService } from "@/lib/actions";
import { Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export type ServiceData = {
  id: string;
  name: string;
  price: number;
  duration: number;
  active: boolean;
};

export function ServiceFormModal({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createService(formData);
        setOpen(false);
        toast.success("Serviço criado");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar serviço");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className={cn("min-h-[44px]", className)}>
        <Plus className="h-4 w-4" /> Novo serviço
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Novo serviço"
        mobileVariant="sheet"
        footer={
          <Button form="service-create-form" type="submit" className="w-full min-h-[44px]" disabled={pending}>
            {pending ? "Salvando..." : "Salvar serviço"}
          </Button>
        }
      >
        <form id="service-create-form" onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Nome" required placeholder="Corte" />
          <Input name="price" label="Valor (R$)" type="number" step="0.01" required />
          <Input name="duration" label="Duração (min)" type="number" defaultValue={30} required />
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function EditServiceModal({
  service,
  trigger,
  className,
}: {
  service: ServiceData;
  trigger?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateService(service.id, formData);
        setOpen(false);
        toast.success("Serviço atualizado");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar");
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
        title="Editar serviço"
        mobileVariant="sheet"
        footer={
          <Button form={`service-edit-${service.id}`} type="submit" className="w-full min-h-[44px]" disabled={pending}>
            {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        }
      >
        <form id={`service-edit-${service.id}`} onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Nome" required defaultValue={service.name} />
          <Input
            name="price"
            label="Valor (R$)"
            type="number"
            step="0.01"
            required
            defaultValue={service.price}
          />
          <Input
            name="duration"
            label="Duração (min)"
            type="number"
            required
            defaultValue={service.duration}
          />
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function ToggleServiceButton({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function runToggle() {
    startTransition(async () => {
      try {
        await toggleService(id, !active);
        toast.success(active ? "Serviço desativado" : "Serviço ativado");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao alterar status");
      }
    });
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (active) {
      setConfirmOpen(true);
    } else {
      runToggle();
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className={cn(
          "inline-flex min-h-[44px] items-center rounded-full px-3 text-xs font-semibold uppercase tracking-wide",
          active ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/80 text-zinc-400"
        )}
      >
        {active ? "Ativo" : "Inativo"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Desativar serviço?"
        description={`"${name}" deixará de aparecer na agenda e nas vendas.`}
        confirmLabel="Desativar"
        tone="danger"
        loading={pending}
        onConfirm={runToggle}
      />
    </>
  );
}
