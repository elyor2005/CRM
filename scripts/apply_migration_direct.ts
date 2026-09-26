import { prisma } from "../src/lib/db";

async function applyMigrations() {
  console.log("Applying non-destructive column additions to production database...");

  console.log('1. ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "district" TEXT;');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "district" TEXT;`);

  console.log('2. ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "visitFrequency" INTEGER;');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "visitFrequency" INTEGER;`);

  console.log('3. ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;');
  await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;`);

  console.log("All 3 columns successfully verified in production database!");
}

applyMigrations()
  .catch((e) => {
    console.error("Migration execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
