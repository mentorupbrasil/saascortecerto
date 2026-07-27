import "server-only";

import { MAX_INLINE_BYTES, ALLOWED_CONTENT_TYPES } from "@/lib/storage/constants";

export { MAX_INLINE_BYTES, ALLOWED_CONTENT_TYPES } from "@/lib/storage/constants";

/**
 * Storage abstraction for tenant assets (client photos, etc.).
 *
 * Migration note: legacy client.photoUrl values may be inline data URLs stored
 * directly in the database. New uploads must NOT persist large base64 blobs in
 * the DB — use object storage (S3/R2) via put() and store only the public URL.
 */

export type StoredObject = {
  url: string;
  contentType: string;
  sizeBytes: number;
};

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

function validateContentType(contentType: string) {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error("Tipo de conteúdo não permitido. Use JPG, PNG ou WebP.");
  }
}

function validateSize(sizeBytes: number) {
  if (sizeBytes > MAX_INLINE_BYTES) {
    throw new Error(
      `Arquivo excede ${MAX_INLINE_BYTES / 1024}KB. Configure STORAGE_PROVIDER=s3|r2 para arquivos maiores.`
    );
  }
}

/**
 * Local provider: stores small files as data URLs (legacy-compatible).
 * Do not use for production at scale — migrate to S3/R2.
 */
class LocalDataUrlStorage implements StorageProvider {
  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    validateContentType(contentType);
    validateSize(data.length);
    const url = `data:${contentType};base64,${data.toString("base64")}`;
    return { url, contentType, sizeBytes: data.length };
  }

  async get(key: string): Promise<Buffer | null> {
    if (key.startsWith("data:")) {
      const match = key.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) return null;
      return Buffer.from(match[1], "base64");
    }
    return null;
  }

  async delete(_key: string): Promise<void> {
    // No-op for inline data URLs
  }
}

class RejectOversizedStorage implements StorageProvider {
  constructor(private readonly message: string) {}

  async put(): Promise<StoredObject> {
    throw new Error(this.message);
  }

  async get(key: string): Promise<Buffer | null> {
    return new LocalDataUrlStorage().get(key);
  }

  async delete(): Promise<void> {}
}

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "s3" || provider === "r2") {
    cached = new RejectOversizedStorage(
      `STORAGE_PROVIDER=${provider} ainda não implementado. Use local ou configure bucket.`
    );
    return cached;
  }

  cached = new LocalDataUrlStorage();
  return cached;
}

/** Read legacy data URL or future object URL */
export async function readStoredObject(urlOrKey: string): Promise<Buffer | null> {
  return getStorageProvider().get(urlOrKey);
}

export async function storeClientPhoto(
  tenantId: string,
  clientId: string,
  data: Buffer,
  contentType: string
): Promise<StoredObject> {
  const key = `tenants/${tenantId}/clients/${clientId}/photo`;
  return getStorageProvider().put(key, data, contentType);
}

export async function deleteClientPhoto(
  tenantId: string,
  clientId: string,
  currentUrl?: string | null
): Promise<void> {
  if (!currentUrl) return;
  const key = `tenants/${tenantId}/clients/${clientId}/photo`;
  await getStorageProvider().delete(currentUrl.startsWith("data:") ? currentUrl : key);
}
