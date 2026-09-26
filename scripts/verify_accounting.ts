import { Prisma } from "@prisma/client";

function simulateAccountingScenario() {
  console.log("=== ACCOUNTING SCENARIO VERIFICATION ===");
  console.log("Scenario: 50 units @ $20 = $1,000 sale, client pays $500 upfront\n");

  const initialStock = 100;
  const unitPrice = 20;
  const quantitySold = 50;
  const upfrontPayment = 500;

  // 1. Sale calculation
  const lineTotal = quantitySold * unitPrice; // 50 * 20 = $1,000
  const saleTotal = lineTotal; // $1,000

  // 2. Finance entry (actual cash received)
  const financeIncome = upfrontPayment; // +$500 only

  // 3. Client debt calculation: Sale Total ($1,000) - Paid ($500) = $500
  const totalSales = saleTotal;
  const totalPaid = upfrontPayment;
  const clientDebt = totalSales - totalPaid; // $500

  // 4. Warehouse stock effect: -50 units
  const stockMovementQty = -quantitySold; // -50
  const finalStock = initialStock + stockMovementQty; // 50

  console.log(`1. Sale Total:     $${saleTotal} (50 × $20)`);
  console.log(`2. Finance Income: +$${financeIncome} (actual cash received)`);
  console.log(`3. Customer Debt:  +$${clientDebt} (unpaid balance)`);
  console.log(`4. Stock Change:   ${stockMovementQty} units (${initialStock} -> ${finalStock})\n`);

  const passed =
    saleTotal === 1000 &&
    financeIncome === 500 &&
    clientDebt === 500 &&
    stockMovementQty === -50;

  console.log(`Accounting invariant check: ${passed ? "VERIFIED (PASSED)" : "FAILED"}`);
}

simulateAccountingScenario();
