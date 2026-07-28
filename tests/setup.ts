import { beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 64 hex chars (32 bytes) — test-only key, never use in production
const TEST_CREDENTIALS_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

// Neon pooler breaks interactive transactions (FOR UPDATE / $transaction).
// Integration tests must use the direct (non-pooler) connection.
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL.trim();
} else if (process.env.DATABASE_URL?.includes("-pooler")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/-pooler(?=\.)/g, "");
}

process.env.CREDENTIALS_ENCRYPTION_KEY ??= TEST_CREDENTIALS_KEY;
process.env.NEXTAUTH_SECRET ??= "test-nextauth-secret-min-16-chars";
process.env.RATE_LIMIT_SECRET ??= "test-rate-limit-secret-min-16";

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    const required =
      process.env.CI === "true" || process.env.REQUIRE_DATABASE === "true";
    const message = required
      ? "DATABASE_URL is required when CI=true or REQUIRE_DATABASE=true"
      : "DATABASE_URL is required for integration tests. Export DATABASE_URL=postgresql://user:pass@localhost:5432/db or add it to .env";
    if (required) {
      throw new Error(message);
    }
  }
});
