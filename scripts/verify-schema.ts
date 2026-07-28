/**
 * Compares live DB schema to prisma/schema.prisma via prisma migrate diff.
 * Exit 1 on drift. Requires DATABASE_URL.
 */
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

try {
  const diff = execSync(
    `npx prisma migrate diff --from-url "${url}" --to-schema-datamodel prisma/schema.prisma --script`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  ).trim();

  if (!diff || diff === "-- This is an empty migration." || diff.length < 5) {
    console.log("Schema verification OK: no drift");
    process.exit(0);
  }

  // Empty migrations sometimes print only comments
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
  console.error("Schema verification failed:", message);
  process.exit(1);
}
