import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = {
  requestId?: string;
  tenantId?: string | null;
  userId?: string | null;
  action?: string;
  entity?: string;
  entityId?: string;
  result?: "success" | "failure" | "skipped";
  durationMs?: number;
  errorCode?: string;
  [key: string]: unknown;
};

const SENSITIVE_KEYS = [
  "token",
  "accessToken",
  "password",
  "secret",
  "authorization",
  "pixKey",
  "copiaECola",
  "whatsappAccessToken",
  "mercadoPagoAccessToken",
  "passwordHash",
];

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

function write(level: LogLevel, message: string, fields: LogFields = {}) {
  const safeFields = redact(fields) as LogFields;
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...safeFields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};

export function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
