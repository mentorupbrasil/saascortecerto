export function maskBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

export function isClientOverdue(
  lastVisitAt: string | Date | null | undefined,
  returnDays: number
): boolean {
  if (!lastVisitAt) return false;
  const date = typeof lastVisitAt === "string" ? new Date(lastVisitAt) : lastVisitAt;
  return daysSince(date) >= returnDays;
}

export async function compressImageFile(
  file: File,
  maxBytes = 500 * 1024
): Promise<File> {
  if (file.size <= maxBytes && file.type === "image/jpeg") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const maxDim = 1024;

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.85;
  let blob: Blob | null = null;

  while (quality >= 0.35) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (blob && blob.size <= maxBytes) break;
    quality -= 0.1;
  }

  if (!blob) {
    throw new Error("Não foi possível comprimir a imagem");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}
