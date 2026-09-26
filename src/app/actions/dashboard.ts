"use server";

import { prisma } from "@/lib/db";

const OPENING_BALANCE_ITEM_NAME = "__OPENING_BALANCE__";

/**
 * Get all dashboard data in a single parallel call for maximum performance.
 */
export async function getDashboardData() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  // Single parallel batch for all independent database queries
  const [
    todaySales,
    todayFinance,
    todayPayments,
    allIncome,
    allExpense,
    allItems,
    allClients,
    allSales,
    recentSales,
    recentPayments,
    recentExpenses,
    recentMovements,
    liabilitiesTotal,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: { date: { gte: startOfDay, lt: endOfDay }, type: "SALE" },
      include: { items: true },
    }),
    prisma.financeEntry.findMany({
      where: { date: { gte: startOfDay, lt: endOfDay } },
    }),
    prisma.payment.findMany({
      where: { date: { gte: startOfDay, lt: endOfDay } },
    }),
    prisma.financeEntry.aggregate({
      where: { type: "INCOME" },
      _sum: { amount: true },
    }),
    prisma.financeEntry.aggregate({
      where: { type: "EXPENSE" },
      _sum: { amount: true },
    }),
    prisma.inventoryItem.findMany({
      where: {
        isSystem: false,
        NOT: { name: OPENING_BALANCE_ITEM_NAME },
      },
    }),
    prisma.client.findMany({
      include: {
        sales: { include: { items: true } },
        payments: true,
      },
    }),
    prisma.sale.findMany({
      where: { type: "SALE" },
      include: { items: true },
    }),
    prisma.sale.findMany({
      include: { client: true, items: true },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.payment.findMany({
      include: { client: true },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.financeEntry.findMany({
      where: { type: "EXPENSE" },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.stockMovement.findMany({
      include: { item: true },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.liabilityEntry.aggregate({
      _sum: { amount: true },
    }),
  ]);

  // Today Calculations
  let todaySalesTotal = 0;
  for (const sale of todaySales) {
    todaySalesTotal += sale.items.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0
    );
  }

  const todayCashReceived =
    todaySales.reduce((sum, s) => sum + Number(s.payment), 0) +
    todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const todayNewDebt = todaySalesTotal - todaySales.reduce(
    (sum, s) => sum + Number(s.payment),
    0
  );

  const todayExpenses = todayFinance
    .filter((e) => e.type === "EXPENSE")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // Position Calculations
  const cashBalance =
    Number(allIncome._sum.amount || 0) - Number(allExpense._sum.amount || 0);

  // Finished goods value at SALE PRICE (Task 1c — renamed card)
  let finishedGoodsSaleValue = 0;
  for (const item of allItems) {
    if (item.category === "FINISHED_GOOD" && item.name !== OPENING_BALANCE_ITEM_NAME) {
      finishedGoodsSaleValue += Number(item.quantity) * Number(item.salePrice || 0);
    }
  }

  let totalReceivables = 0;
  for (const client of allClients) {
    let clientDebt = 0;
    let clientPaymentsOnSales = 0;
    for (const sale of client.sales) {
      const saleTotal = sale.items.reduce(
        (sum, item) => sum + Number(item.lineTotal),
        0
      );
      if (sale.type === "SALE") clientDebt += saleTotal;
      else clientDebt -= saleTotal;
      clientPaymentsOnSales += Number(sale.payment);
    }
    const standalonePayments = client.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const debt = clientDebt - clientPaymentsOnSales - standalonePayments;
    if (debt > 0) totalReceivables += debt;
  }

  let totalSalesAllTime = 0;
  for (const sale of allSales) {
    totalSalesAllTime += sale.items.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0
    );
  }

  let totalCOGS = 0;
  for (const sale of allSales) {
    for (const item of sale.items) {
      const product = allItems.find((p) => p.id === item.productId);
      if (product) {
        totalCOGS += Number(item.quantity) * Number(product.costPrice);
      }
    }
  }

  const grossProfit = totalSalesAllTime - totalCOGS;
  const totalExpenses = Number(allExpense._sum.amount || 0);
  const netProfit = grossProfit - totalExpenses;

  // Liabilities total (Task 1c)
  const liabTotal = Number(liabilitiesTotal._sum.amount || 0);

  // Today's total payments (sale-time + standalone) — for the "Оплата" card (Task 1c)
  const todayTotalPayments =
    todayFinance.filter(e => e.type === "INCOME").reduce((sum, e) => sum + Number(e.amount), 0);

  // Alerts
  const lowStockItems = allItems.filter(
    (item) => item.name !== OPENING_BALANCE_ITEM_NAME && Number(item.minStock) > 0 && Number(item.quantity) < Number(item.minStock)
  );

  const debtClients: { id: string; name: string; debt: number }[] = [];
  for (const client of allClients) {
    let clientDebt = 0;
    let clientPaymentsOnSales = 0;
    for (const sale of client.sales) {
      const saleTotal = sale.items.reduce(
        (sum, item) => sum + Number(item.lineTotal),
        0
      );
      if (sale.type === "SALE") clientDebt += saleTotal;
      else clientDebt -= saleTotal;
      clientPaymentsOnSales += Number(sale.payment);
    }
    const standalonePayments = client.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const debt = clientDebt - clientPaymentsOnSales - standalonePayments;
    if (debt > 0) {
      debtClients.push({ id: client.id, name: client.name, debt });
    }
  }
  debtClients.sort((a, b) => b.debt - a.debt);

  // Overdue visit clients (Task 7)
  const overdueVisitClients: { id: string; name: string; daysOverdue: number }[] = [];
  for (const client of allClients) {
    if (!client.visitFrequency || client.visitFrequency <= 0) continue;

    // Find last REAL sale (exclude opening balance placeholders)
    let lastRealSaleDate: Date | null = null;
    for (const sale of client.sales) {
      if (sale.type !== "SALE") continue;
      // Check if this is an opening balance sale
      const isOpeningBalance = sale.items.some(
        (item) => item.freebieFor === "Начальный долг"
      );
      if (isOpeningBalance) continue;
      if (!lastRealSaleDate || sale.date > lastRealSaleDate) {
        lastRealSaleDate = sale.date;
      }
    }

    if (!lastRealSaleDate) {
      // Client has frequency set but no real sales — consider overdue since creation
      const daysSince = Math.floor((now.getTime() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > client.visitFrequency) {
        overdueVisitClients.push({
          id: client.id,
          name: client.name,
          daysOverdue: daysSince - client.visitFrequency,
        });
      }
      continue;
    }

    const daysSinceLastSale = Math.floor(
      (now.getTime() - lastRealSaleDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastSale > client.visitFrequency) {
      overdueVisitClients.push({
        id: client.id,
        name: client.name,
        daysOverdue: daysSinceLastSale - client.visitFrequency,
      });
    }
  }
  overdueVisitClients.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    today: {
      sales: todaySalesTotal,
      cashReceived: todayCashReceived,
      newDebt: todayNewDebt,
      expenses: todayExpenses,
      totalPayments: todayTotalPayments,
    },
    position: {
      totalReceivables,
      finishedGoodsSaleValue,
      cashBalance,
      liabilitiesTotal: liabTotal,
      totalSales: totalSalesAllTime,
      totalExpenses,
      grossProfit,
      netProfit,
    },
    alerts: {
      lowStockItems: lowStockItems.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: Number(i.quantity),
        minStock: Number(i.minStock),
        unit: i.unit,
      })),
      debtClients,
      overdueVisitClients,
    },
    recent: {
      sales: recentSales.map((s) => ({
        id: s.id,
        clientName: s.client.name,
        date: s.date,
        total: s.items.reduce((sum, i) => sum + Number(i.lineTotal), 0),
        payment: Number(s.payment),
      })),
      payments: recentPayments.map((p) => ({
        id: p.id,
        clientName: p.client.name,
        date: p.date,
        amount: Number(p.amount),
        method: p.method,
      })),
      expenses: recentExpenses.map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date,
        amount: Number(e.amount),
      })),
      movements: recentMovements.map((m) => ({
        id: m.id,
        itemName: m.item.name,
        type: m.type,
        quantity: Number(m.quantity),
        date: m.date,
      })),
    },
  };
}
