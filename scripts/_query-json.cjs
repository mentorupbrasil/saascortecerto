const { PrismaClient } = require("@prisma/client");

const sql = process.env.PREFLIGHT_SQL;
if (!sql) {
  console.error("PREFLIGHT_SQL required");
  process.exit(1);
}

const prisma = new PrismaClient();
prisma
  .$queryRawUnsafe(sql)
  .then((rows) => {
    process.stdout.write(JSON.stringify(rows));
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
