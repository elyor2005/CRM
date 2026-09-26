"use server";

import { prisma } from "@/lib/db";
import { LiabilityEntrySchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

/**
 * Get the full balance report data with historical date snapshot reconstruction (Task Group 8a).
 * DEBIT: inventory value by category + cash balance + client debts
 * CREDIT: manual liability entries
 */
export async function getBalanceReport(options?: { asOfDate?: string }) {
  const asOf = options?.asOfDate ? new Date(options.asOfDate) : null;
  if (asOf) {
    asOf.setHours(23, 59, 59, 999);
  }

  const dateFilter = asOf ? { lte: asOf } : undefined;

  // Single parallel batch for all 5 independent queries
  const [items, income, expense, clients, liabilities] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { NOT: { name: "__OPENING_BALANCE__" } },
      include: asOf ? { stockMovements: true } : undefined,
    }),
    prisma.financeEntry.aggregate({
      where: {
        type: "INCOME",
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      _sum: { amount: true },
    }),
    prisma.financeEntry.aggregate({
      where: {
        type: "EXPENSE",
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      _sum: { amount: true },
    }),
    prisma.client.findMany({
      include: {
        sales: {
          where: dateFilter ? { date: dateFilter } : undefined,
          include: { items: true },
        },
        payments: {
          where: dateFilter ? { date: dateFilter } : undefined,
        },
      },
    }),
    prisma.liabilityEntry.findMany({
      where: dateFilter ? { date: dateFilter } : undefined,
      orderBy: { date: "desc" },
    }),
  ]);

  // Inventory value by category (reconstructed as of date if specified)
  const inventoryByCategory: Record<string, number> = {
    FINISHED_GOOD: 0,
    RAW_MATERIAL: 0,
    PACKAGING: 0,
  };

  for (const item of items) {
    let effectiveQty = Number(item.quantity);

    if (asOf && "stockMovements" in item && Array.isArray((item as any).stockMovements)) {
      const movements = (item as any).stockMovements as Array<{
        type: string;
        quantity: any;
        date: Date;
      }>;
      for (const mov of movements) {
        if (new Date(mov.date) > asOf) {
          const mQty = Number(mov.quantity);
          if (mov.type === "PRODUCTION_IN" || mov.type === "RETURN_IN") {
            effectiveQty -= mQty;
          } else if (
            mov.type === "SALE_OUT" ||
            mov.type === "DEFECT" ||
            mov.type === "BONUS" ||
            mov.type === "PRODUCTION_CONSUME"
          ) {
            effectiveQty += mQty;
          } else if (mov.type === "ADJUSTMENT") {
            effectiveQty -= mQty;
          }
        }
      }
      if (effectiveQty < 0) effectiveQty = 0;
    }

    inventoryByCategory[item.category] =
      (inventoryByCategory[item.category] || 0) +
      effectiveQty * Number(item.costPrice);
  }

  // Cash balance
  const cashBalance =
    Number(income._sum.amount || 0) - Number(expense._sum.amount || 0);

  // Total client debts (debts owed TO us = receivables)
  let totalReceivables = 0;
  for (const client of clients) {
    let clientSalesTotal = 0;
    let clientPaymentsOnSales = 0;

    for (const sale of client.sales) {
      const saleTotal = sale.items.reduce(
        (sum, item) => sum + Number(item.lineTotal),
        0
      );
      if (sale.type === "SALE") {
        clientSalesTotal += saleTotal;
      } else {
        clientSalesTotal -= saleTotal;
      }
      clientPaymentsOnSales += Number(sale.payment);
    }

    const standalonePayments = client.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const debt = clientSalesTotal - clientPaymentsOnSales - standalonePayments;
    if (debt > 0) totalReceivables += debt;
  }

  const totalLiabilities = liabilities.reduce(
    (sum, l) => sum + Number(l.amount),
    0
  );

  const debitTotal =
    inventoryByCategory.FINISHED_GOOD +
    inventoryByCategory.RAW_MATERIAL +
    inventoryByCategory.PACKAGING +
    cashBalance +
    totalReceivables;

  const creditTotal = totalLiabilities;

  return {
    debit: {
      finishedGoods: inventoryByCategory.FINISHED_GOOD,
      rawMaterials: inventoryByCategory.RAW_MATERIAL,
      packaging: inventoryByCategory.PACKAGING,
      cash: cashBalance,
      receivables: totalReceivables,
      total: debitTotal,
    },
    credit: {
      liabilities,
      total: creditTotal,
    },
    netBalance: debitTotal - creditTotal,
  };
}

export async function createLiabilityEntry(data: unknown) {
  const parsed = LiabilityEntrySchema.parse(data);

  await prisma.liabilityEntry.create({
    data: {
      name: parsed.name,
      amount: new Prisma.Decimal(parsed.amount),
      date: new Date(parsed.date),
    },
  });

  safeRevalidate("/report");
  safeRevalidate("/liabilities");
  safeRevalidate("/dashboard");
}

export async function updateLiabilityEntry(id: string, data: unknown) {
  const parsed = LiabilityEntrySchema.parse(data);

  await prisma.liabilityEntry.update({
    where: { id },
    data: {
      name: parsed.name,
      amount: new Prisma.Decimal(parsed.amount),
      date: new Date(parsed.date),
    },
  });

  safeRevalidate("/report");
  safeRevalidate("/liabilities");
  safeRevalidate("/dashboard");
}

export async function deleteLiabilityEntry(id: string) {
  await prisma.liabilityEntry.delete({ where: { id } });
  safeRevalidate("/report");
  safeRevalidate("/liabilities");
  safeRevalidate("/dashboard");
}
