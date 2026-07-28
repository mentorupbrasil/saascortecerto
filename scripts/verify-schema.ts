/**
 * Compares live DB schema to prisma/schema.prisma via prisma migrate diff.
 * Exit 1 on drift. Requires DATABASE_URL.
 * Uses execFileSync with argv array — never interpolates DATABASE_URL into a shell string.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const prismaCli = path.join(
  process.cwd(),
  "node_modules",
  "prisma",
  "build",
  "index.js"
);

try {
  const diff = execFileSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-url",
      url,
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: url },
      stdio: ["ignore", "pipe", "pipe"],
    }
  ).trim();

  const meaningful = diff
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--"));

  if (meaningful.length === 0) {
    console.log("Schema verification OK: no drift");
    process.exit(0);
  }

  console.error("Schema drift detected:\n");
  console.error(diff);
  process.exit(1);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const stderr =
    err && typeof err === "object" && "stderr" in err
      ? String((err as { stderr?: Buffer | string }).stderr ?? "")
      : "";
  console.error("Schema verification failed:", message);
  if (stderr) console.error(stderr);
  process.exit(1);
}
