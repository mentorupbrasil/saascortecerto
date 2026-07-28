/**
 * Ensures DIRECT_URL for Prisma migrate/generate on Neon.
 * Prefer explicit DIRECT_URL; otherwise derive from DATABASE_URL by
 * stripping the Neon pooler hostname suffix (-pooler.).
 *
 * Loads .env / .env.local when vars are missing (Prisma does this too).
 *
 * Usage: node scripts/run-with-direct-url.cjs <cmd> [args...]
 * Example: node scripts/run-with-direct-url.cjs npx prisma migrate deploy
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function deriveDirectUrl(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    u.hostname = u.hostname.replace(/-pooler(?=\.)/g, "");
    // channel_binding can break some Node TLS stacks; migrate does not need it
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return databaseUrl.replace(/-pooler\./g, ".");
  }
}

function ensureDirectUrl() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  if (process.env.DIRECT_URL && process.env.DIRECT_URL.trim()) {
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.trim()) {
    console.error(
      "run-with-direct-url: DATABASE_URL is required to derive DIRECT_URL"
    );
    process.exit(1);
  }
  process.env.DIRECT_URL = deriveDirectUrl(databaseUrl);
  console.log(
    "run-with-direct-url: DIRECT_URL derived from DATABASE_URL (non-pooler)"
  );
}

ensureDirectUrl();

// Also persist for subsequent plain `npx prisma …` invocations in CI.
try {
  require("./ensure-direct-url-env.cjs");
} catch {
  // best-effort
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error("Usage: node scripts/run-with-direct-url.cjs <command> [args...]");
  process.exit(1);
}

const command = argv[0];
const args = argv.slice(1);

// Neon/serverless: advisory locks often hang across brief disconnects (P1002).
// Safe for migrate deploy — Prisma still records applied migrations transactionally.
const isMigrateDeploy =
  args.includes("migrate") && args.includes("deploy");
if (isMigrateDeploy && !process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK) {
  process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = "1";
  console.log(
    "run-with-direct-url: PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 (Neon migrate)"
  );
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status === null ? 1 : result.status);
