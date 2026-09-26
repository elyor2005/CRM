import { prisma } from "../src/lib/db";
import { createClient, getClientsWithDebt } from "../src/app/actions/clients";
import { getProducts, getSales, deleteSale } from "../src/app/actions/sales";
import { getInventoryByCategory, getFinishedGoodsMovementBreakdown, getAllItems } from "../src/app/actions/inventory";
import { getBalanceReport } from "../src/app/actions/report";
import { getProfitReport } from "../src/app/actions/profit";

async function runSmokeTests() {
  console.log("=== RUNNING PRODUCTION SMOKE TESTS (CHECKS 1 - 6) ===\n");

  // Record baseline numbers before test
  const balanceBefore = await getBalanceReport();
  const baselineReceivables = balanceBefore.debit.receivables;
  console.log(`Baseline receivables before test: ${baselineReceivables} UZS\n`);

  // Check 1: Create one test client with district and opening debt of 1,000
  console.log("Check 1: Creating test client with district and 1,000 opening debt...");
  const testClientName = `SmokeTest_Client_${Date.now()}`;
  const testClient = await createClient({
    name: testClientName,
    district: "Чиланзар",
    openingDebt: "1000",
  });
  console.log(`> PASS: Created client ID=${testClient.id}, Name=${testClient.name}, District=${testClient.district}\n`);

  // Check 2: Confirm the test client shows the correct debt immediately
  console.log("Check 2: Verifying test client debt in getClientsWithDebt()...");
  const clientsWithDebt = await getClientsWithDebt();
  const createdClientRecord = clientsWithDebt.find((c) => c.id === testClient.id);
  const clientDebtCorrect = createdClientRecord?.debt === 1000;
  console.log(`> Found Client Debt: ${createdClientRecord?.debt} (Expected 1000)`);
  console.log(`> Result: ${clientDebtCorrect ? "PASS" : "FAIL"}\n`);

  // Check 3: Go to Продажа's product picker and confirm no "__OPENING_BALANCE__" or system item appears
  console.log("Check 3: Verifying getProducts() product picker has no system items...");
  const products = await getProducts();
  const hasOpeningInProducts = products.some(
    (p) => p.name === "__OPENING_BALANCE__" || (p as any).isSystem === true
  );
  console.log(`> Products count: ${products.length}, Contains system item: ${hasOpeningInProducts}`);
  console.log(`> Result: ${!hasOpeningInProducts ? "PASS" : "FAIL"}\n`);

  // Check 4: Go to Склад and Settings — confirm no system item visible
  console.log("Check 4: Verifying Warehouse & Settings queries have no system items...");
  const [warehouseGroups, fgBreakdown, settingsItems] = await Promise.all([
    getInventoryByCategory(),
    getFinishedGoodsMovementBreakdown(),
    getAllItems(),
  ]);

  const hasInWarehouseGroups = Object.values(warehouseGroups).flat().some(
    (item) => item.name === "__OPENING_BALANCE__" || (item as any).isSystem === true
  );
  const hasInFgBreakdown = fgBreakdown.some(
    (item) => item.name === "__OPENING_BALANCE__"
  );
  const hasInSettings = settingsItems.some(
    (item) => item.name === "__OPENING_BALANCE__" || (item as any).isSystem === true
  );

  console.log(`> Warehouse groups contains system item: ${hasInWarehouseGroups}`);
  console.log(`> Warehouse movement breakdown contains system item: ${hasInFgBreakdown}`);
  console.log(`> Settings table contains system item: ${hasInSettings}`);
  const check4Pass = !hasInWarehouseGroups && !hasInFgBreakdown && !hasInSettings;
  console.log(`> Result: ${check4Pass ? "PASS" : "FAIL"}\n`);

  // Check 5: Open Отчёт — confirm balance/report numbers are sane (no NaN, sane totals)
  console.log("Check 5: Verifying Отчёт balance and profit reports...");
  const [balanceAfter, profitReport] = await Promise.all([
    getBalanceReport(),
    getProfitReport(),
  ]);

  const isBalanceSane =
    !isNaN(balanceAfter.netBalance) &&
    !isNaN(balanceAfter.debit.total) &&
    !isNaN(balanceAfter.credit.total) &&
    balanceAfter.debit.total > 0;

  const isProfitSane =
    !isNaN(profitReport.netProfit) &&
    !isNaN(profitReport.totalSales) &&
    !isNaN(profitReport.cogs);

  console.log(`> Balance Net: ${balanceAfter.netBalance}, Debit: ${balanceAfter.debit.total}, Credit: ${balanceAfter.credit.total}`);
  console.log(`> Profit Net: ${profitReport.netProfit}, Net Sales: ${profitReport.netSales}, COGS: ${profitReport.cogs}`);
  const check5Pass = isBalanceSane && isProfitSane;
  console.log(`> Result: ${check5Pass ? "PASS" : "FAIL"}\n`);

  // Check 6: Delete the test client and its placeholder sale/debt record, verify totals return to prior state
  console.log("Check 6: Deleting test client and verifying cleanup...");
  // Find placeholder sale for this client
  const clientSales = await prisma.sale.findMany({
    where: { clientId: testClient.id },
  });

  for (const s of clientSales) {
    await deleteSale(s.id);
  }

  await prisma.client.delete({
    where: { id: testClient.id },
  });

  const balanceFinal = await getBalanceReport();
  const finalReceivables = balanceFinal.debit.receivables;
  const cleanedUpProperly = finalReceivables === baselineReceivables;

  console.log(`> Baseline Receivables: ${baselineReceivables}`);
  console.log(`> Final Receivables after delete: ${finalReceivables}`);
  console.log(`> Result: ${cleanedUpProperly ? "PASS" : "FAIL"}\n`);

  console.log("=== ALL 6 CHECKS EXECUTED SUCCESSFULLY ===");
}

runSmokeTests()
  .catch((e) => {
    console.error("Smoke tests failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
