import "server-only";

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
    merchantName: process.env.PLATFORM_PIX_NAME?.trim() || "CorteCerto",
    merchantCity: process.env.PLATFORM_PIX_CITY?.trim() || "SAO PAULO",
  };
}

export function getPlatformSupportEmail() {
  return process.env.PLATFORM_BILLING_EMAIL?.trim() || "suporte@cortecerto.com";
}
