const MAX_PHOTO_BYTES = 500 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePhotoFile(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Formato inválido. Use JPG, PNG ou WebP.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Foto muito grande. Máximo 500KB.");
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  validatePhotoFile(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export function isPhotoDataUrl(url: string | null | undefined) {
  return !!url?.startsWith("data:image/");
}

export function getPhotoSrc(photoUrl: string | null | undefined) {
  if (!photoUrl) return null;
  return photoUrl;
}
