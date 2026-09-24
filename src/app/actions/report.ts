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
 * Get the full balance report data.
 * DEBIT: inventory value by category + cash balance + client debts
 * CREDIT: manual liability entries
 */
export async function getBalanceReport() {
  // Single parallel batch for all 5 independent queries
  const [items, income, expense, clients, liabilities] = await Promise.all([
    prisma.inventoryItem.findMany(),
    prisma.financeEntry.aggregate({
      where: { type: "INCOME" },
      _sum: { amount: true },
    }),
    prisma.financeEntry.aggregate({
      where: { type: "EXPENSE" },
      _sum: { amount: true },
    }),
    prisma.client.findMany({
      include: {
        sales: { include: { items: true } },
        payments: true,
      },
    }),
    prisma.liabilityEntry.findMany({
      orderBy: { date: "desc" },
    }),
  ]);

  // Inventory value by category
  const inventoryByCategory: Record<string, number> = {
    FINISHED_GOOD: 0,
    RAW_MATERIAL: 0,
    PACKAGING: 0,
  };

  for (const item of items) {
    inventoryByCategory[item.category] =
      (inventoryByCategory[item.category] || 0) +
      Number(item.quantity) * Number(item.costPrice);
  }

  // Cash balance
  const cashBalance =
    Number(income._sum.amount || 0) - Number(expense._sum.amount || 0);

  // Total client debts (debts owed TO us = receivables)
  let totalReceivables = 0;
  for (const client of clients) {
    let clientDebt = 0;
    let clientPaymentsOnSales = 0;

    for (const sale of client.sales) {
      const saleTotal = sale.items.reduce(
        (sum, item) => sum + Number(item.lineTotal),
        0
      );
      if (sale.type === "SALE") {
        clientDebt += saleTotal;
      } else {
        clientDebt -= saleTotal;
      }
      clientPaymentsOnSales += Number(sale.payment);
    }

    const standalonePayments = client.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const debt = clientDebt - clientPaymentsOnSales - standalonePayments;
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
}

export async function deleteLiabilityEntry(id: string) {
  await prisma.liabilityEntry.delete({ where: { id } });
  safeRevalidate("/report");
}
