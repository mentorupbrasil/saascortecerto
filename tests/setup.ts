import { beforeAll } from "vitest";

// 64 hex chars (32 bytes) — test-only key, never use in production
const TEST_CREDENTIALS_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= TEST_CREDENTIALS_KEY;
  process.env.NEXTAUTH_SECRET ??= "test-nextauth-secret-min-16-chars";

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
