import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(32).optional(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  PLATFORM_PIX_KEY: z.string().optional(),
  PLATFORM_PIX_NAME: z.string().optional(),
  PLATFORM_PIX_CITY: z.string().optional(),
  PLATFORM_BILLING_EMAIL: z.string().email().optional().or(z.literal("")),
  WHATSAPP_DEMO_MODE: z.enum(["true", "false"]).optional(),
  SIGNUP_DEMO_MODE: z.enum(["true", "false"]).optional(),
  BOOKING_DEMO_MODE: z.enum(["true", "false"]).optional(),
  SENTRY_DSN: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["local", "s3", "r2"]).optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  AI_ENABLED: z.enum(["true", "false"]).optional(),
  AI_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Variáveis de ambiente inválidas: ${details}`);
  }

  if (parsed.data.NODE_ENV === "production") {
    if (!parsed.data.NEXTAUTH_SECRET) {
      throw new Error("NEXTAUTH_SECRET é obrigatória em produção");
    }
    if (!parsed.data.CREDENTIALS_ENCRYPTION_KEY) {
      throw new Error("CREDENTIALS_ENCRYPTION_KEY é obrigatória em produção");
    }
    if (!parsed.data.CRON_SECRET) {
      throw new Error("CRON_SECRET é obrigatória em produção");
    }
  }

  cached = parsed.data;
  return cached;
}

export function isDemoModeAllowed() {
  const env = getServerEnv();
  return env.NODE_ENV !== "production";
}

export function isWhatsAppDemoMode() {
  if (!isDemoModeAllowed()) return false;
  return process.env.WHATSAPP_DEMO_MODE === "true";
}

export function isSignupDemoMode() {
  if (!isDemoModeAllowed()) return false;
  return process.env.SIGNUP_DEMO_MODE === "true";
}

export function isBookingDemoMode() {
  if (!isDemoModeAllowed()) return false;
  return (
    process.env.BOOKING_DEMO_MODE === "true" ||
    process.env.SIGNUP_DEMO_MODE === "true"
  );
}

export function isAiEnabled() {
  return process.env.AI_ENABLED === "true" && !!process.env.AI_API_KEY?.trim();
}
