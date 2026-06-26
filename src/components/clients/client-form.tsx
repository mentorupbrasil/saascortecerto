"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createClient, updateClient } from "@/lib/actions";
import { Plus, Pencil, X, Camera, Trash2 } from "lucide-react";
import { format } from "date-fns";

type Client = {
  id: string;
  name: string;
  phone: string;
  birthday: Date | null;
  notes: string | null;
  returnDays: number;
  photoUrl?: string | null;
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
}: {
  client?: Client;
  edit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(client?.photoUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setError("Foto máximo 500KB");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function removePhoto() {
    if (!client?.id) {
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    await fetch("/api/upload/client-photo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id }),
    });
    setPreview(null);
    router.refresh();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const photoFile = fileRef.current?.files?.[0];

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
        } else if (photoFile && client?.id) {
          await uploadClientPhoto(client.id, photoFile);
        }

        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  return (
    <>
      {edit ? (
        <button
          onClick={() => {
            setPreview(client?.photoUrl ?? null);
            setOpen(true);
          }}
          className="mt-1 text-xs text-amber-400 hover:underline flex items-center gap-1"
        >
          <Pencil className="h-3 w-3" /> Editar
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {edit ? "Editar cliente" : "Novo cliente"}
              </h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="h-24 w-24 rounded-full object-cover border-2 border-amber-500/30"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-zinc-800 flex items-center justify-center">
                    <Camera className="h-8 w-8 text-zinc-600" />
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="cursor-pointer rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700">
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
                      className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Remover
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-600">JPG, PNG ou WebP · máx 500KB</p>
              </div>

              <Input name="name" label="Nome" required defaultValue={client?.name} />
              <Input name="phone" label="Telefone" required defaultValue={client?.phone} />
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
              />
              <Textarea name="notes" label="Observações" defaultValue={client?.notes ?? undefined} />

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
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
        className={`${sizes[size]} rounded-full object-cover border border-zinc-700`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-zinc-800 flex items-center justify-center font-bold text-amber-400`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
