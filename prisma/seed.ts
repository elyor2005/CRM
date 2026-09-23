import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed script skeleton.
 * Add initial clients or inventory items here if needed.
 */

async function main() {
  console.log("🌱 Seed script initialized.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
