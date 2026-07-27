import { describe, expect, it } from "vitest";
import {
  decryptCredential,
  encryptCredential,
  isEncryptedCredential,
} from "@/lib/crypto/credentials";

describe("credentials encryption", () => {
  it("roundtrips encrypt and decrypt", () => {
    const plain = "APP_USR-secret-token-12345";
    const encrypted = encryptCredential(plain);

    expect(isEncryptedCredential(encrypted)).toBe(true);
    expect(encrypted).not.toContain(plain);
    expect(decryptCredential(encrypted)).toBe(plain);
  });

  it("returns null for empty values", () => {
    expect(decryptCredential(null)).toBeNull();
    expect(decryptCredential("")).toBeNull();
  });

  it("returns legacy plaintext unchanged when not encrypted", () => {
    const legacy = "legacy-plain-token";
    expect(decryptCredential(legacy)).toBe(legacy);
    expect(isEncryptedCredential(legacy)).toBe(false);
  });
});

describe("DTO shapes must not expose token fields", () => {
  it("public booking settings DTO has no token fields", () => {
    const dto = {
      enabled: true,
      notifyPhone: null,
      requirePixPayment: false,
      pixKey: null,
      pixHolderName: null,
      pixCity: null,
      mercadoPagoConfigured: true,
    };

    expect(dto).not.toHaveProperty("mercadoPagoAccessToken");
    expect(dto).not.toHaveProperty("accessToken");
    expect(dto).not.toHaveProperty("token");
    expect(typeof dto.mercadoPagoConfigured).toBe("boolean");
  });

  it("whatsapp settings DTO has whatsappTokenConfigured not whatsappAccessToken", () => {
    const dto = {
      whatsappEnabled: true,
      whatsappPhoneNumberId: "123",
      whatsappReturnTemplate: "Olá {nome}!",
      autoReturnEnabled: false,
      returnMessageDays: 20,
      lastBulkSendAt: null,
      whatsappTokenConfigured: true,
    };

    expect(dto).toHaveProperty("whatsappTokenConfigured");
    expect(dto).not.toHaveProperty("whatsappAccessToken");
    expect(typeof dto.whatsappTokenConfigured).toBe("boolean");
  });
});
