import { beforeAll } from "vitest";

// 64 hex chars (32 bytes) — test-only key, never use in production
const TEST_CREDENTIALS_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= TEST_CREDENTIALS_KEY;
});
