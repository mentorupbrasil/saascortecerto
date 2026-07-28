/**
 * Ensures DIRECT_URL exists for Prisma CLI (schema requires directUrl).
 * - Prefer existing DIRECT_URL / .env value
 * - Else derive non-pooler URL from DATABASE_URL
 * - Else copy DATABASE_URL as-is (local CI Postgres)
 *
 * Writes/updates root .env so later `npx prisma …` steps inherit it
 * (Prisma loads .env automatically). Never prints secrets.
 */
const fs = require("fs");
const path = require("path");

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return {};
  const out = {};
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
    out[key] = value;
  }
  return out;
}

function deriveDirectUrl(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    u.hostname = u.hostname.replace(/-pooler(?=\.)/g, "");
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return databaseUrl.replace(/-pooler\./g, ".");
  }
}

function ensureDirectUrlEnv() {
  const fileEnv = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
  const databaseUrl = (process.env.DATABASE_URL || fileEnv.DATABASE_URL || "").trim();
  let directUrl = (process.env.DIRECT_URL || fileEnv.DIRECT_URL || "").trim();

  if (!directUrl) {
    if (!databaseUrl) return;
    directUrl = databaseUrl.includes("-pooler")
      ? deriveDirectUrl(databaseUrl)
      : databaseUrl;
  }

  process.env.DIRECT_URL = directUrl;

  const envPath = path.join(process.cwd(), ".env");
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  if (/^DIRECT_URL=/m.test(existing)) return;

  const line = `DIRECT_URL=${directUrl}\n`;
  fs.appendFileSync(envPath, existing && !existing.endsWith("\n") ? `\n${line}` : line);
}

ensureDirectUrlEnv();
module.exports = { ensureDirectUrlEnv };
