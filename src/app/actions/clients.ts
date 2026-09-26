"use server";

import { prisma } from "@/lib/db";
import { ClientSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

const OPENING_BALANCE_ITEM_NAME = "__OPENING_BALANCE__";

async function getOrCreateOpeningBalanceItem(tx: Prisma.TransactionClient) {
  let item = await tx.inventoryItem.findUnique({ where: { name: OPENING_BALANCE_ITEM_NAME } });
  if (!item) {
    item = await tx.inventoryItem.create({
      data: {
        name: OPENING_BALANCE_ITEM_NAME,
        category: "FINISHED_GOOD",
        unit: "шт",
        quantity: 0,
        costPrice: 0,
        salePrice: 0,
        minStock: 0,
        isSystem: true,
      },
    });
  }
  return item;
}

export async function getClients() {
  return prisma.client.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getClient(id: string) {
  return prisma.client.findUnique({
    where: { id },
  });
}

export async function createClient(data: unknown) {
  const parsed = ClientSchema.parse(data);
  const client = await prisma.client.create({
    data: {
      name: parsed.name,
      phone: parsed.phone || null,
      address: parsed.address || null,
      district: parsed.district || null,
      visitFrequency: parsed.visitFrequency != null && !isNaN(Number(parsed.visitFrequency)) && Number(parsed.visitFrequency) > 0
        ? Number(parsed.visitFrequency)
        : null,
    },
  });

  // Create opening balance (debt) if provided, without touching inventory
  const openingDebt = parsed.openingDebt != null ? Number(parsed.openingDebt) : 0;
  if (openingDebt > 0) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const placeholderItem = await getOrCreateOpeningBalanceItem(tx);

      const sale = await tx.sale.create({
        data: {
          date: new Date(),
          type: "SALE",
          clientId: client.id,
          payment: new Prisma.Decimal(0),
        },
      });

      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: placeholderItem.id,
          quantity: new Prisma.Decimal(1),
          unitPrice: new Prisma.Decimal(openingDebt),
          lineTotal: new Prisma.Decimal(openingDebt),
          isFreebie: false,
          freebieFor: "Начальный долг", // marker to identify opening balance items
        },
      });
      // No StockMovement, no InventoryItem.quantity update — intentional.
      // No FinanceEntry because no cash was received (debt only).
    });
  }

  revalidatePath("/debts");
  revalidatePath("/sales");
  return client;
}

export async function updateClient(id: string, data: unknown) {
  const parsed = ClientSchema.parse(data);
  const client = await prisma.client.update({
    where: { id },
    data: {
      name: parsed.name,
      phone: parsed.phone || null,
      address: parsed.address || null,
      district: parsed.district || null,
      visitFrequency: parsed.visitFrequency != null && !isNaN(Number(parsed.visitFrequency)) && Number(parsed.visitFrequency) > 0
        ? Number(parsed.visitFrequency)
        : null,
    },
  });
  revalidatePath("/debts");
  return client;
}

/**
 * Get all clients with their computed debt, last sale date,
 * and 30-day sales sum.
 */
export async function getClientsWithDebt() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      district: true,
      visitFrequency: true,
    },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const results = await Promise.all(
    clients.map(async (client) => {
      // Compute debt: sum of sale totals (SALE adds debt, RETURN reduces) minus payments
      const sales = await prisma.sale.findMany({
        where: { clientId: client.id },
        include: { items: true },
        orderBy: { date: "desc" },
      });

      let totalSalesValue = 0;
      let totalPaymentsOnSales = 0;
      let lastSaleDate: Date | null = null;
      let last30DaysSalesSum = 0;

      for (const sale of sales) {
        const saleTotal = sale.items.reduce(
          (sum, item) => sum + Number(item.lineTotal),
          0
        );

        if (sale.type === "SALE") {
          totalSalesValue += saleTotal;
        } else {
          // RETURN reduces debt
          totalSalesValue -= saleTotal;
        }

        totalPaymentsOnSales += Number(sale.payment);

        if (!lastSaleDate || sale.date > lastSaleDate) {
          lastSaleDate = sale.date;
        }

        if (sale.type === "SALE" && sale.date >= thirtyDaysAgo) {
          last30DaysSalesSum += saleTotal;
        }
      }

      // Standalone payments
      const payments = await prisma.payment.aggregate({
        where: { clientId: client.id },
        _sum: { amount: true },
      });
      const totalStandalonePayments = Number(payments._sum.amount || 0);

      const debt = totalSalesValue - totalPaymentsOnSales - totalStandalonePayments;
      const totalPaid = totalPaymentsOnSales + totalStandalonePayments;

      return {
        ...client,
        debt,
        totalSalesValue,
        totalPaid,
        lastSaleDate,
        last30DaysSalesSum,
      };
    })
  );

  // Sort by debt descending
  results.sort((a, b) => b.debt - a.debt);
  return results;
}

/**
 * Get client's transaction history: sales + payments, chronological
 */
export async function getClientHistory(clientId: string) {
  const [sales, payments] = await Promise.all([
    prisma.sale.findMany({
      where: { clientId },
      include: { items: { include: { product: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.payment.findMany({
      where: { clientId },
      orderBy: { date: "desc" },
    }),
  ]);

  return { sales, payments };
}

export async function getClientDebt(clientId: string) {
  const sales = await prisma.sale.findMany({
    where: { clientId },
    include: { items: true },
  });

  let totalSalesDebt = 0;
  let totalPaymentsOnSales = 0;

  for (const sale of sales) {
    const saleTotal = sale.items.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0
    );
    if (sale.type === "SALE") {
      totalSalesDebt += saleTotal;
    } else {
      totalSalesDebt -= saleTotal;
    }
    totalPaymentsOnSales += Number(sale.payment);
  }

  const payments = await prisma.payment.aggregate({
    where: { clientId },
    _sum: { amount: true },
  });
  const totalStandalonePayments = Number(payments._sum.amount || 0);

  return totalSalesDebt - totalPaymentsOnSales - totalStandalonePayments;
}

/**
 * Get detailed client stats including debt aging
 */
export async function getClientDetailedStats(clientId: string) {
  const [sales, payments] = await Promise.all([
    prisma.sale.findMany({
      where: { clientId },
      include: { items: { include: { product: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.payment.findMany({
      where: { clientId },
      orderBy: { date: "desc" },
    }),
  ]);

  const now = new Date();
  let totalSalesValue = 0;
  let totalPaymentsOnSales = 0;
  let lastSaleDate: Date | null = null;

  // Debt aging: track unpaid amounts per age bucket
  const debtAging = { days0to7: 0, days8to30: 0, days31to60: 0, days60plus: 0 };

  for (const sale of sales) {
    if (sale.type !== "SALE") continue;
    const saleTotal = sale.items.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0
    );
    totalSalesValue += saleTotal;
    totalPaymentsOnSales += Number(sale.payment);

    if (!lastSaleDate || sale.date > lastSaleDate) {
      lastSaleDate = sale.date;
    }

    // Unpaid portion of this sale
    const unpaid = saleTotal - Number(sale.payment);
    if (unpaid > 0) {
      const daysSince = Math.floor((now.getTime() - new Date(sale.date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 7) debtAging.days0to7 += unpaid;
      else if (daysSince <= 30) debtAging.days8to30 += unpaid;
      else if (daysSince <= 60) debtAging.days31to60 += unpaid;
      else debtAging.days60plus += unpaid;
    }
  }

  // Add return adjustments to sales value
  for (const sale of sales) {
    if (sale.type !== "RETURN") continue;
    const returnTotal = sale.items.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0
    );
    totalSalesValue -= returnTotal;
    totalPaymentsOnSales += Number(sale.payment);
  }

  const totalStandalonePayments = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  const totalPaid = totalPaymentsOnSales + totalStandalonePayments;
  const currentDebt = totalSalesValue - totalPaid;

  return {
    totalSalesValue,
    totalPaid,
    currentDebt,
    lastSaleDate,
    debtAging,
    salesCount: sales.filter((s) => s.type === "SALE").length,
    returnsCount: sales.filter((s) => s.type === "RETURN").length,
    paymentsCount: payments.length,
  };
}
