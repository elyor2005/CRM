"use server";

import { prisma } from "@/lib/db";

/**
 * Get profit/performance report (Task Group 8b, 8c, 8d).
 * - Gross Sales = sum of all SALE line totals
 * - Returns = sum of all RETURN line totals
 * - Net Sales = Gross Sales - Returns
 * - COGS = sum of (sale quantity × costPrice) - sum of (return quantity × costPrice)
 * - Gross Profit = Net Sales - COGS
 * - Operating Expenses = sum of EXPENSE finance entries grouped by category
 * - Net Profit = Gross Profit - Operating Expenses
 */
export async function getProfitReport(options?: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const dateFilter: { date?: { gte?: Date; lte?: Date } } = {};
  if (options?.dateFrom || options?.dateTo) {
    dateFilter.date = {};
    if (options.dateFrom) {
      dateFilter.date.gte = new Date(options.dateFrom);
    }
    if (options.dateTo) {
      const end = new Date(options.dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.date.lte = end;
    }
  }

  // Single parallel batch for sales, returns, and operating expenses
  const [sales, returns, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { type: "SALE", ...dateFilter },
      include: {
        items: {
          include: { product: true },
        },
      },
    }),
    prisma.sale.findMany({
      where: { type: "RETURN", ...dateFilter },
      include: {
        items: {
          include: { product: true },
        },
      },
    }),
    prisma.financeEntry.findMany({
      where: { type: "EXPENSE", ...dateFilter },
    }),
  ]);

  let grossSales = 0;
  let totalCOGS = 0;

  for (const sale of sales) {
    for (const item of sale.items) {
      grossSales += Number(item.lineTotal);
      totalCOGS += Number(item.quantity) * Number(item.product.costPrice);
    }
  }

  // Returns
  let totalReturns = 0;
  let returnsCOGS = 0;
  for (const ret of returns) {
    for (const item of ret.items) {
      totalReturns += Number(item.lineTotal);
      returnsCOGS += Number(item.quantity) * Number(item.product.costPrice);
    }
  }

  const netSales = grossSales - totalReturns;
  const netCOGS = totalCOGS - returnsCOGS;
  const grossProfit = netSales - netCOGS;

  let totalExpenses = 0;
  const expenseByCategory: Record<string, number> = {};

  for (const expense of expenses) {
    const amount = Number(expense.amount);
    totalExpenses += amount;
    const cat = expense.category || "__UNCATEGORIZED__";
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amount;
  }

  const netProfit = grossProfit - totalExpenses;
  const profitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  return {
    grossSales,
    totalSales: netSales,
    netSales,
    totalReturns,
    cogs: netCOGS,
    grossProfit,
    profitMargin: Math.round(profitMargin * 10) / 10,
    operatingExpenses: totalExpenses,
    expenseByCategory,
    netProfit,
    netMargin: Math.round(netMargin * 10) / 10,
    salesCount: sales.length,
    returnsCount: returns.length,
  };
}
