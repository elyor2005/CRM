import { prisma } from "../src/lib/db";

async function main() {
  console.log("=== CLEARING ALL DATABASE DATA (RESETTING TO EMPTY STATE) ===\n");

  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.recipeLine.deleteMany(),
    prisma.saleItem.deleteMany(),
    prisma.financeEntry.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.liabilityEntry.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.client.deleteMany(),
  ]);

  console.log("✓ AuditLog: cleared");
  console.log("✓ StockMovement: cleared");
  console.log("✓ RecipeLine: cleared");
  console.log("✓ SaleItem: cleared");
  console.log("✓ FinanceEntry: cleared");
  console.log("✓ Payment: cleared");
  console.log("✓ Sale: cleared");
  console.log("✓ LiabilityEntry: cleared");
  console.log("✓ InventoryItem: cleared");
  console.log("✓ Client: cleared");

  console.log("\n=== DATABASE IS NOW COMPLETELY EMPTY AND READY FOR PRODUCTION USE ===");
}

main()
  .catch((e) => {
    console.error("Error clearing DB:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
