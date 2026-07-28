"use client";

import { useState, useTransition, useRef, useEffect, cloneElement, isValidElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useToast } from "@/components/ui/toast";
import { createClient, updateClient } from "@/lib/actions";
import { compressImageFile, maskBrazilianPhone } from "@/lib/client-utils";
import { formatPhone } from "@/lib/utils";
import { Plus, Pencil, Camera, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Client = {
  id: string;
  name: string;
  phone: string;
  birthday: string | null;
  notes: string | null;
  returnDays: number;
  photoUrl?: string | null;
  whatsappOptIn?: boolean;
};

async function uploadClientPhoto(clientId: string, file: File) {
  const formData = new FormData();
  formData.append("photo", file);
  formData.append("clientId", clientId);

  const res = await fetch("/api/upload/client-photo", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Erro no upload");
  }
}

export function ClientFormModal({
  client,
  edit,
  trigger,
  className,
}: {
  client?: Client;
  edit?: boolean;
  trigger?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(client?.photoUrl ?? null);
  const [phone, setPhone] = useState(formatPhone(client?.phone ?? ""));
  const [dirty, setDirty] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setPreview(client?.photoUrl ?? null);
      setPhone(formatPhone(client?.phone ?? ""));
      setPhotoFile(null);
      setError("");
      setFieldErrors({});
      setDirty(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open, client]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem JPG, PNG ou WebP");
      return;
    }

    setError("");
    try {
      const compressed = await compressImageFile(file);
      setPhotoFile(compressed);
      setDirty(true);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar foto");
    }
  }

  async function removePhoto() {
    if (!client?.id) {
      setPreview(null);
      setPhotoFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setDirty(true);
      return;
    }
    await fetch("/api/upload/client-photo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id }),
    });
    setPreview(null);
    setPhotoFile(null);
    setDirty(true);
    router.refresh();
  }

  function validateForm(formData: FormData): boolean {
    const errors: Record<string, string> = {};
    const name = String(formData.get("name") ?? "").trim();
    const phoneDigits = phone.replace(/\D/g, "");

    if (name.length < 2) {
      errors.name = "Nome deve ter pelo menos 2 caracteres";
    }
    if (phoneDigits.length < 10) {
      errors.phone = "Telefone inválido (mínimo 10 dígitos)";
    }

    const returnDays = Number(formData.get("returnDays"));
    if (Number.isNaN(returnDays) || returnDays < 7 || returnDays > 60) {
      errors.returnDays = "Retorno deve ser entre 7 e 60 dias";
    }

    if (!edit && !formData.get("dataConsent")) {
      errors.dataConsent = "Consentimento LGPD é obrigatório para novos clientes";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("phone", phone.replace(/\D/g, ""));

    if (!validateForm(formData)) return;

    startTransition(async () => {
      try {
        let clientId = client?.id;

        if (client && edit) {
          await updateClient(client.id, formData);
          clientId = client.id;
        } else {
          const result = await createClient(formData);
          clientId = result.id;
        }

        if (photoFile && clientId) {
          await uploadClientPhoto(clientId, photoFile);
        }

        toast.success(edit ? "Cliente atualizado" : "Cliente cadastrado");
        setOpen(false);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao salvar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  const formId = edit ? `edit-client-${client?.id}` : "new-client-form";

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
              e.stopPropagation();
              (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
              setOpen(true);
            },
            className: cn(
              (trigger.props as { className?: string }).className,
              className
            ),
          }
        )
      ) : edit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex min-h-[44px] items-center gap-1 text-xs text-amber-400 hover:underline",
            className
          )}
        >
          <Pencil className="h-3 w-3" /> Editar
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} className={cn("min-h-[44px]", className)}>
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      )}

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={edit ? "Editar cliente" : "Novo cliente"}
        mobileVariant="full"
        dirty={dirty}
        footer={
          <Button
            type="submit"
            form={formId}
            className="w-full min-h-[44px]"
            disabled={pending}
          >
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        }
      >
        <form
          id={formId}
          onSubmit={handleSubmit}
          className="space-y-4"
          onChange={() => setDirty(true)}
        >
          <div className="flex flex-col items-center gap-3">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="h-24 w-24 rounded-full border-2 border-amber-500/30 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800">
                <Camera className="h-8 w-8 text-zinc-600" />
              </div>
            )}
            <div className="flex gap-2">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700">
                Escolher foto
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {preview && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400"
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-600">JPG, PNG ou WebP — comprimido automaticamente</p>
          </div>

          <Input
            name="name"
            label="Nome"
            required
            defaultValue={client?.name}
            error={fieldErrors.name}
            onChange={() => setDirty(true)}
          />
          <Input
            name="phone"
            label="Telefone"
            required
            value={phone}
            onChange={(e) => {
              setPhone(maskBrazilianPhone(e.target.value));
              setDirty(true);
            }}
            inputMode="tel"
            error={fieldErrors.phone}
          />
          <Input
            name="birthday"
            label="Aniversário"
            type="date"
            defaultValue={
              client?.birthday
                ? format(new Date(client.birthday), "yyyy-MM-dd")
                : undefined
            }
          />
          <Input
            name="returnDays"
            label="Dias para retorno (WhatsApp)"
            type="number"
            min={7}
            max={60}
            defaultValue={client?.returnDays ?? 20}
            error={fieldErrors.returnDays}
          />
          <Textarea
            name="notes"
            label="Observações"
            defaultValue={client?.notes ?? undefined}
          />

          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 p-3">
            <input
              type="checkbox"
              name="whatsappOptIn"
              defaultChecked={client?.whatsappOptIn ?? true}
              className="mt-1 rounded border-zinc-600"
            />
            <span className="text-sm text-zinc-300">
              Autoriza mensagens WhatsApp (lembretes e retorno)
            </span>
          </label>

          {!edit && (
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 p-3">
              <input
                type="checkbox"
                name="dataConsent"
                className="mt-1 rounded border-zinc-600"
              />
              <span className="text-sm text-zinc-300">
                Cliente consente com tratamento de dados (LGPD)
              </span>
            </label>
          )}
          {fieldErrors.dataConsent && (
            <p className="text-xs text-red-400">{fieldErrors.dataConsent}</p>
          )}

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function ClientAvatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "h-10 w-10 text-sm", md: "h-12 w-12 text-lg", lg: "h-16 w-16 text-xl" };

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizes[size]} rounded-full border border-zinc-700 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} flex items-center justify-center rounded-full bg-zinc-800 font-bold text-amber-400`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
