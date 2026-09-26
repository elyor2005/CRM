"use server";

import { prisma } from "@/lib/db";

const OPENING_BALANCE_ITEM_NAME = "__OPENING_BALANCE__";

/**
 * Get all dashboard data in a single parallel call for maximum performance.
 */
export type PeriodPreset = "TODAY" | "7_DAYS" | "30_DAYS" | "THIS_MONTH" | "CUSTOM";

export interface DashboardOptions {
  periodPreset?: PeriodPreset;
  dateFrom?: string;
  dateTo?: string;
  asOfDate?: string;
}

/**
 * Get all dashboard data in a single parallel call for maximum performance.
 * Supports period presets for "Итоги за период" and asOfDate for "Текущая позиция".
 */
export async function getDashboardData(options?: DashboardOptions) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  // Period range for "Итоги за период" (default TODAY)
  const preset: PeriodPreset = options?.periodPreset || "TODAY";
  let periodStart: Date = startOfDay;
  let periodEnd: Date = endOfDay;

  if (preset === "7_DAYS") {
    periodStart = new Date(startOfDay);
    periodStart.setDate(periodStart.getDate() - 7);
    periodEnd = endOfDay;
  } else if (preset === "30_DAYS") {
    periodStart = new Date(startOfDay);
    periodStart.setDate(periodStart.getDate() - 30);
    periodEnd = endOfDay;
  } else if (preset === "THIS_MONTH") {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = endOfDay;
  } else if (preset === "CUSTOM") {
    if (options?.dateFrom) {
      periodStart = new Date(options.dateFrom);
    }
    if (options?.dateTo) {
      periodEnd = new Date(options.dateTo);
      periodEnd.setHours(23, 59, 59, 999);
    }
  }

  // asOfDate for "Текущая позиция"
  const asOf = options?.asOfDate ? new Date(options.asOfDate) : null;
  if (asOf) {
    asOf.setHours(23, 59, 59, 999);
  }
  const asOfFilter = asOf ? { lte: asOf } : undefined;
  const isPeriodToday = preset === "TODAY";

  // Single parallel batch for all independent database queries
  const [
    todaySales,
    todayFinance,
    todayPayments,
    periodSales,
    periodReturns,
    periodIncome,
    periodExpense,
    allIncome,
    allExpense,
    allItems,
    allClients,
    recentSales,
    recentPayments,
    recentExpenses,
    recentMovements,
    liabilitiesTotal,
  ] = await Promise.all([
    // Today stats (strictly startOfDay to endOfDay)
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

    // Period summary queries
    isPeriodToday
      ? Promise.resolve([])
      : prisma.sale.findMany({
          where: { date: { gte: periodStart, lte: periodEnd }, type: "SALE" },
          include: { items: true },
        }),
    isPeriodToday
      ? Promise.resolve([])
      : prisma.sale.findMany({
          where: { date: { gte: periodStart, lte: periodEnd }, type: "RETURN" },
          include: { items: true },
        }),
    isPeriodToday
      ? Promise.resolve(null)
      : prisma.financeEntry.aggregate({
          where: { type: "INCOME", date: { gte: periodStart, lte: periodEnd } },
          _sum: { amount: true },
        }),
    isPeriodToday
      ? Promise.resolve(null)
      : prisma.financeEntry.aggregate({
          where: { type: "EXPENSE", date: { gte: periodStart, lte: periodEnd } },
          _sum: { amount: true },
        }),

    // Current position balance queries (as of date if specified, otherwise live)
    prisma.financeEntry.aggregate({
      where: { type: "INCOME", ...(asOfFilter ? { date: asOfFilter } : {}) },
      _sum: { amount: true },
    }),
    prisma.financeEntry.aggregate({
      where: { type: "EXPENSE", ...(asOfFilter ? { date: asOfFilter } : {}) },
      _sum: { amount: true },
    }),
    prisma.inventoryItem.findMany({
      where: {
        isSystem: false,
        NOT: { name: OPENING_BALANCE_ITEM_NAME },
      },
      include: asOf ? { stockMovements: true } : undefined,
    }),
    prisma.client.findMany({
      include: {
        sales: {
          where: asOfFilter ? { date: asOfFilter } : undefined,
          include: { items: true },
        },
        payments: {
          where: asOfFilter ? { date: asOfFilter } : undefined,
        },
      },
    }),
    // Recent activity
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
      where: asOfFilter ? { date: asOfFilter } : undefined,
      _sum: { amount: true },
    }),
  ]);

  // Today Calculations (Strictly today, unaffected by period selector)
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

  const todayTotalPayments =
    todayFinance.filter(e => e.type === "INCOME").reduce((sum, e) => sum + Number(e.amount), 0);

  // Period Calculations ("Итоги за период")
  let periodSalesTotal = 0;
  let periodCOGS = 0;

  const actualPeriodSales = isPeriodToday ? todaySales : (periodSales as typeof todaySales);
  for (const sale of actualPeriodSales) {
    for (const item of sale.items) {
      periodSalesTotal += Number(item.lineTotal);
      const product = allItems.find((p) => p.id === item.productId);
      if (product) {
        periodCOGS += Number(item.quantity) * Number(product.costPrice);
      }
    }
  }

  // Returns in period
  let periodReturnsTotal = 0;
  let periodReturnsCOGS = 0;
  if (!isPeriodToday && Array.isArray(periodReturns)) {
    for (const ret of periodReturns as typeof todaySales) {
      for (const item of ret.items) {
        periodReturnsTotal += Number(item.lineTotal);
        const product = allItems.find((p) => p.id === item.productId);
        if (product) {
          periodReturnsCOGS += Number(item.quantity) * Number(product.costPrice);
        }
      }
    }
  }

  const periodNetSales = periodSalesTotal - periodReturnsTotal;
  const periodEffectiveCOGS = periodCOGS - periodReturnsCOGS;
  const periodGrossProfit = periodNetSales - periodEffectiveCOGS;

  const periodPaymentsTotal = isPeriodToday
    ? todayTotalPayments
    : Number(periodIncome?._sum.amount || 0);

  const periodExpensesTotal = isPeriodToday
    ? todayExpenses
    : Number(periodExpense?._sum.amount || 0);

  const periodNetProfit = periodGrossProfit - periodExpensesTotal;

  // Position Calculations ("Текущая позиция" - live or as of date)
  const cashBalance =
    Number(allIncome._sum.amount || 0) - Number(allExpense._sum.amount || 0);

  // Finished goods value at SALE PRICE
  let finishedGoodsSaleValue = 0;
  for (const item of allItems) {
    if (item.category === "FINISHED_GOOD" && item.name !== OPENING_BALANCE_ITEM_NAME) {
      let qty = Number(item.quantity);
      if (asOf && "stockMovements" in item && Array.isArray((item as any).stockMovements)) {
        for (const mov of (item as any).stockMovements) {
          if (new Date(mov.date) > asOf) {
            const mQty = Number(mov.quantity);
            if (mov.type === "PRODUCTION_IN" || mov.type === "RETURN_IN") {
              qty -= mQty;
            } else if (
              mov.type === "SALE_OUT" ||
              mov.type === "DEFECT" ||
              mov.type === "BONUS" ||
              mov.type === "PRODUCTION_CONSUME"
            ) {
              qty += mQty;
            } else if (mov.type === "ADJUSTMENT") {
              qty -= mQty;
            }
          }
        }
        if (qty < 0) qty = 0;
      }
      finishedGoodsSaleValue += qty * Number(item.salePrice || 0);
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

  // Liabilities total
  const liabTotal = Number(liabilitiesTotal._sum.amount || 0);

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
      totalSales: periodNetSales,
      totalExpenses: periodExpensesTotal,
      grossProfit: periodGrossProfit,
      netProfit: periodNetProfit,
    },
    periodSummary: {
      totalSales: periodNetSales,
      totalPayments: periodPaymentsTotal,
      totalExpenses: periodExpensesTotal,
      grossProfit: periodGrossProfit,
      netProfit: periodNetProfit,
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
