import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENVELOPE_PREFIX = "ccenc:v1:";

function getEncryptionKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  // Derive 32-byte key from provided secret (hex or passphrase)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256").update(raw).digest();
}

export function isCredentialsEncryptionConfigured() {
  return !!getEncryptionKey();
}

/**
 * Encrypts a secret with AES-256-GCM.
 * Format: ccenc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CREDENTIALS_ENCRYPTION_KEY não configurada");
    }
    // Dev fallback: still mark envelope so we can detect plaintext vs encrypted
    return plaintext;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX.slice(0, -1),
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function isEncryptedCredential(value: string | null | undefined): boolean {
  return !!value && value.startsWith(ENVELOPE_PREFIX);
}

/**
 * Decrypts an encrypted envelope or returns legacy plaintext unchanged.
 * Never log the returned value.
 */
export function decryptCredential(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(ENVELOPE_PREFIX)) {
    return value; // legacy plaintext
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error("Não foi possível descriptografar credencial: chave ausente");
  }

  const parts = value.split(":");
  // ccenc : v1 : iv : tag : ciphertext
  if (parts.length !== 5 || parts[0] !== "ccenc" || parts[1] !== "v1") {
    throw new Error("Envelope de credencial inválido");
  }

  const iv = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const ciphertext = Buffer.from(parts[4], "base64url");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Encrypt for storage. Empty/null stays null. Already-encrypted values are left as-is.
 */
export function prepareCredentialForStorage(
  incoming: string | null | undefined,
  existingEncryptedOrPlain: string | null | undefined
): string | null {
  const trimmed = incoming?.trim() ?? "";
  if (!trimmed) {
    // Preserve existing
    if (!existingEncryptedOrPlain) return null;
    if (isEncryptedCredential(existingEncryptedOrPlain)) {
      return existingEncryptedOrPlain;
    }
    // Migrate legacy plaintext on write-through
    return encryptCredential(existingEncryptedOrPlain);
  }
  return encryptCredential(trimmed);
}

export function credentialConfigured(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}
