import "server-only";

import { brand } from "@/config/brand";

export type PlatformPixConfig = {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
};

export function getPlatformPixConfig(): PlatformPixConfig | null {
  const pixKey = process.env.PLATFORM_PIX_KEY?.trim();
  if (!pixKey) return null;

  return {
    pixKey,
    // env override recommended in production; falls back to brand default
    merchantName: process.env.PLATFORM_PIX_NAME?.trim() || brand.name,
    merchantCity: process.env.PLATFORM_PIX_CITY?.trim() || "SAO PAULO",
  };
}

export function getPlatformSupportEmail() {
  // Placeholder domain — cortzo.com is not registered yet. Override via env in production.
  return process.env.PLATFORM_BILLING_EMAIL?.trim() || "suporte@example.com";
}
