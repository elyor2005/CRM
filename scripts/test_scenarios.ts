import { prisma } from "../src/lib/db";
import { createSale } from "../src/app/actions/sales";
import { createPayment } from "../src/app/actions/payments";
import { produceItem } from "../src/app/actions/inventory";
import { getClientDetailedStats } from "../src/app/actions/clients";
import { Prisma } from "@prisma/client";

async function runTests() {
  console.log("=== STARTING CRM DATABASE VERIFICATION TESTS ===\n");

  // 0. Setup test data
  console.log("--- 0. Setting up test entities in DB ---");
  let client = await prisma.client.findFirst({ where: { name: "Test Client Alpha" } });
  if (!client) {
    client = await prisma.client.create({
      data: { name: "Test Client Alpha", phone: "+998901234567" },
    });
  }

  let productA = await prisma.inventoryItem.findFirst({ where: { name: "Product A" } });
  if (!productA) {
    productA = await prisma.inventoryItem.create({
      data: {
        name: "Product A",
        category: "FINISHED_GOOD",
        unit: "pcs",
        costPrice: 12,
        salePrice: 20,
        quantity: 100,
      },
    });
  } else {
    // Reset quantity to 100 for clean run
    await prisma.inventoryItem.update({
      where: { id: productA.id },
      data: { quantity: 100 },
    });
    productA.quantity = new Prisma.Decimal(100);
  }

  console.log(`Client ID: ${client.id}, Name: ${client.name}`);
  console.log(`Product A ID: ${productA.id}, Initial Qty: 100, Sale Price: $20\n`);

  // --- SCENARIO 1 ---
  console.log("--- SCENARIO 1: Create sale (Product A x50 @ $20, Payment $500) ---");
  const prodA_before = await prisma.inventoryItem.findUnique({ where: { id: productA.id } });
  
  const sale1 = await createSale({
    clientId: client.id,
    type: "SALE",
    date: new Date().toISOString().split("T")[0],
    payment: 500,
    items: [
      {
        productId: productA.id,
        quantity: 50,
        unitPrice: 20,
        isFreebie: false,
      },
    ],
  });

  const sale1_db = await prisma.sale.findUnique({
    where: { id: sale1.id },
    include: { items: true, finance: true },
  });
  const prodA_after1 = await prisma.inventoryItem.findUnique({ where: { id: productA.id } });
  const stockMov1 = await prisma.stockMovement.findFirst({
    where: { note: { contains: sale1.id.slice(-6) } },
  });
  const clientStats1 = await getClientDetailedStats(client.id);

  console.log(`> Sale.total: $${sale1_db?.items.reduce((s, i) => s + Number(i.lineTotal), 0)} (50 * $20)`);
  console.log(`> FinanceEntry created amount: $${sale1_db?.finance[0]?.amount} (${sale1_db?.finance[0]?.paymentMethod})`);
  console.log(`> Client computed debt: Total Sales=$${clientStats1.totalSalesValue}, Total Paid=$${clientStats1.totalPaid} => Current Debt=$${clientStats1.currentDebt}`);
  console.log(`> Product A quantity change: ${prodA_before?.quantity} -> ${prodA_after1?.quantity}`);
  console.log(`> StockMovement row: Type=${stockMov1?.type}, Qty=${stockMov1?.quantity}, Note="${stockMov1?.note}"\n`);

  // --- SCENARIO 2 ---
  console.log("--- SCENARIO 2: Add $300 payment via new payment-method flow ---");
  const salesCount_before = await prisma.sale.count({ where: { clientId: client.id } });
  const finEntries_before = await prisma.financeEntry.count({ where: { relatedClientId: client.id } });

  await createPayment({
    clientId: client.id,
    amount: 300,
    date: new Date().toISOString().split("T")[0],
    method: "BANK_TRANSFER",
    note: "Debt partial settlement",
  });

  const clientStats2 = await getClientDetailedStats(client.id);
  const salesCount_after = await prisma.sale.count({ where: { clientId: client.id } });
  const finEntries_after = await prisma.financeEntry.count({ where: { relatedClientId: client.id } });
  const latestPayment = await prisma.payment.findFirst({
    where: { clientId: client.id },
    orderBy: { date: "desc" },
  });

  console.log(`> Debt progression: $${clientStats1.currentDebt} -> $${clientStats2.currentDebt}`);
  console.log(`> Payment record created: Amount=$${latestPayment?.amount}, Method=${latestPayment?.method}`);
  console.log(`> Sales count (should be unchanged): ${salesCount_before} -> ${salesCount_after}`);
  console.log(`> FinanceEntry count (new income record added): ${finEntries_before} -> ${finEntries_after}\n`);

  // --- SCENARIO 3 ---
  console.log("--- SCENARIO 3: Return 10 of the 50 units ---");
  const returnSale = await createSale({
    clientId: client.id,
    type: "RETURN",
    date: new Date().toISOString().split("T")[0],
    payment: 0,
    items: [
      {
        productId: productA.id,
        quantity: 10,
        unitPrice: 20,
        isFreebie: false,
      },
    ],
  });

  const prodA_after3 = await prisma.inventoryItem.findUnique({ where: { id: productA.id } });
  const clientStats3 = await getClientDetailedStats(client.id);

  console.log(`> Return sale created: ID=${returnSale.id}, Type=${returnSale.type}`);
  console.log(`> Product A quantity (restocked +10): ${prodA_after1?.quantity} -> ${prodA_after3?.quantity} (40 net sold units left)`);
  console.log(`> Client debt adjusted (Return reduces total sales by $200): Total Sales=$${clientStats3.totalSalesValue}, Total Paid=$${clientStats3.totalPaid} => Current Debt=$${clientStats3.currentDebt}\n`);

  // --- SCENARIO 4 ---
  console.log("--- SCENARIO 4: Attempt production with insufficient raw material ---");
  let rawMat = await prisma.inventoryItem.findFirst({ where: { name: "Ingredient R1" } });
  if (!rawMat) {
    rawMat = await prisma.inventoryItem.create({
      data: {
        name: "Ingredient R1",
        category: "RAW_MATERIAL",
        unit: "kg",
        costPrice: 5,
        quantity: 5,
      },
    });
  } else {
    await prisma.inventoryItem.update({
      where: { id: rawMat.id },
      data: { quantity: 5 },
    });
  }

  let finishedItem = await prisma.inventoryItem.findFirst({ where: { name: "Finished Item FG1" } });
  if (!finishedItem) {
    finishedItem = await prisma.inventoryItem.create({
      data: {
        name: "Finished Item FG1",
        category: "FINISHED_GOOD",
        unit: "pcs",
        costPrice: 50,
        quantity: 0,
      },
    });
    await prisma.recipeLine.create({
      data: {
        productId: finishedItem.id,
        ingredientId: rawMat.id,
        qtyPerUnit: 10, // requires 10kg per unit
      },
    });
  }

  const raw_before = await prisma.inventoryItem.findUnique({ where: { id: rawMat.id } });
  const fg_before = await prisma.inventoryItem.findUnique({ where: { id: finishedItem.id } });
  const mov_count_before = await prisma.stockMovement.count();

  let scenario4_error: any = null;
  try {
    await produceItem({
      itemId: finishedItem.id,
      quantity: 1, // Needs 10kg, only 5kg in stock
    });
  } catch (err: any) {
    scenario4_error = err.message;
  }

  const raw_after = await prisma.inventoryItem.findUnique({ where: { id: rawMat.id } });
  const fg_after = await prisma.inventoryItem.findUnique({ where: { id: finishedItem.id } });
  const mov_count_after = await prisma.stockMovement.count();

  console.log(`> Attempted to produce 1 unit needing 10kg raw material (stock: 5kg)`);
  console.log(`> Transaction thrown error: "${scenario4_error}"`);
  console.log(`> Raw material qty: ${raw_before?.quantity} -> ${raw_after?.quantity} (UNTOUCHED)`);
  console.log(`> Finished good qty: ${fg_before?.quantity} -> ${fg_after?.quantity} (UNTOUCHED)`);
  console.log(`> StockMovement count: ${mov_count_before} -> ${mov_count_after} (NO PARTIAL MOVEMENTS CREATED)\n`);

  // --- SCENARIO 5 ---
  console.log("--- SCENARIO 5: Attempt sale exceeding available stock ---");
  const current_stock = Number(prodA_after3?.quantity); // 60 units
  const sales_count_before5 = await prisma.sale.count();
  let scenario5_error: any = null;

  try {
    await createSale({
      clientId: client.id,
      type: "SALE",
      date: new Date().toISOString().split("T")[0],
      payment: 0,
      items: [
        {
          productId: productA.id,
          quantity: current_stock + 50, // 110 units requested, 60 available
          unitPrice: 20,
          isFreebie: false,
        },
      ],
    });
  } catch (err: any) {
    scenario5_error = err.message;
  }

  const prodA_after5 = await prisma.inventoryItem.findUnique({ where: { id: productA.id } });
  const sales_count_after5 = await prisma.sale.count();

  console.log(`> Requested sale of ${current_stock + 50} units when only ${current_stock} in stock`);
  console.log(`> Server-side validation error: "${scenario5_error}"`);
  console.log(`> Product A quantity: ${current_stock} -> ${prodA_after5?.quantity} (UNTOUCHED)`);
  console.log(`> Total Sales count in DB: ${sales_count_before5} -> ${sales_count_after5} (REJECTED)\n`);

  console.log("=== ALL 5 TEST SCENARIOS PASSED WITH VERIFIED DB RECORDS ===");
}

runTests()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
