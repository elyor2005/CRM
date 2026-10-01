"use server";

import { prisma } from "@/lib/db";
import { LiabilityEntrySchema, AssetEntrySchema } from "@/lib/validations";
import { revalidateAll } from "@/lib/revalidate";
import { Prisma } from "@prisma/client";
import { logAction } from "./audit";
import { REAL_ITEMS_FILTER } from "@/lib/constants";

/**
 * Get the full balance report data with historical date snapshot reconstruction.
 * DEBIT: inventory value (Finished Goods at SALE PRICE, raw/pkg at cost) + cash balance + client receivables + manual assets
 * CREDIT: manual liability entries
 */
export async function getBalanceReport(options?: { asOfDate?: string }) {
  const asOf = options?.asOfDate ? new Date(options.asOfDate) : null;
  if (asOf) {
    asOf.setHours(23, 59, 59, 999);
  }

  const dateFilter = asOf ? { lte: asOf } : undefined;

  // Single parallel batch for independent queries
  const [items, income, expense, clients, liabilities] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: REAL_ITEMS_FILTER,
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

  // Query AssetEntry with safe fallback if table is not yet migrated
  let assetEntries: any[] = [];
  try {
    assetEntries = await prisma.assetEntry.findMany({
      where: dateFilter ? { date: dateFilter } : undefined,
      orderBy: { date: "desc" },
    });
  } catch (e) {
    console.warn("AssetEntry query fallback (table may not be created yet):", e);
  }

  // Inventory value by category:
  // Finished Goods valued at SALE PRICE (Part 2 Item E policy change)
  // Raw materials and Packaging valued at COST PRICE
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
          effectiveQty -= Number(mov.quantity);
        }
      }
      if (effectiveQty < 0) effectiveQty = 0;
    }

    const unitPrice =
      item.category === "FINISHED_GOOD"
        ? (item.salePrice ? Number(item.salePrice) : Number(item.costPrice))
        : Number(item.costPrice);

    inventoryByCategory[item.category] =
      (inventoryByCategory[item.category] || 0) +
      effectiveQty * unitPrice;
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

  const totalAssets = assetEntries.reduce(
    (sum, a) => sum + Number(a.amount),
    0
  );

  const debitTotal =
    inventoryByCategory.FINISHED_GOOD +
    inventoryByCategory.RAW_MATERIAL +
    inventoryByCategory.PACKAGING +
    cashBalance +
    totalReceivables +
    totalAssets;

  const creditTotal = totalLiabilities;

  return {
    debit: {
      finishedGoods: inventoryByCategory.FINISHED_GOOD,
      rawMaterials: inventoryByCategory.RAW_MATERIAL,
      packaging: inventoryByCategory.PACKAGING,
      cash: cashBalance,
      receivables: totalReceivables,
      assets: assetEntries,
      assetsTotal: totalAssets,
      total: debitTotal,
    },
    credit: {
      liabilities,
      total: creditTotal,
    },
    netBalance: debitTotal - creditTotal,
  };
}

// ─── Liability Entries ────────────────────────────────────────────────────────

export async function createLiabilityEntry(data: unknown) {
  const parsed = LiabilityEntrySchema.parse(data);

  const entry = await prisma.liabilityEntry.create({
    data: {
      name: parsed.name,
      amount: new Prisma.Decimal(parsed.amount),
      date: new Date(parsed.date),
    },
  });

  await logAction({
    action: "CREATE",
    entity: "LiabilityEntry",
    entityId: entry.id,
    description: `Добавлено обязательство: ${parsed.name} — ${parsed.amount}`,
    snapshot: {
      id: entry.id,
      name: entry.name,
      amount: Number(entry.amount),
      date: entry.date,
    },
  });

  revalidateAll();
  return entry;
}

export async function updateLiabilityEntry(id: string, data: unknown) {
  const parsed = LiabilityEntrySchema.parse(data);
  const old = await prisma.liabilityEntry.findUnique({ where: { id } });

  const entry = await prisma.liabilityEntry.update({
    where: { id },
    data: {
      name: parsed.name,
      amount: new Prisma.Decimal(parsed.amount),
      date: new Date(parsed.date),
    },
  });

  await logAction({
    action: "UPDATE",
    entity: "LiabilityEntry",
    entityId: id,
    description: `Обновлено обязательство: ${parsed.name} — ${parsed.amount}`,
    snapshot: {
      previous: old
        ? { id: old.id, name: old.name, amount: Number(old.amount), date: old.date }
        : null,
    },
  });

  revalidateAll();
  return entry;
}

export async function deleteLiabilityEntry(id: string) {
  const old = await prisma.liabilityEntry.findUnique({ where: { id } });
  await prisma.liabilityEntry.delete({ where: { id } });

  const logId = await logAction({
    action: "DELETE",
    entity: "LiabilityEntry",
    entityId: id,
    description: `Удалено обязательство: ${old?.name || id}`,
    snapshot: {
      deletedRecord: old
        ? { id: old.id, name: old.name, amount: Number(old.amount), date: old.date }
        : null,
    },
  });

  revalidateAll();
  return { logId };
}

// ─── Manual Asset Entries (Part 2 Item F) ────────────────────────────────────

export async function createAssetEntry(data: unknown) {
  const parsed = AssetEntrySchema.parse(data);

  const entry = await prisma.assetEntry.create({
    data: {
      name: parsed.name,
      amount: new Prisma.Decimal(parsed.amount),
      date: new Date(parsed.date),
    },
  });

  await logAction({
    action: "CREATE",
    entity: "AssetEntry",
    entityId: entry.id,
    description: `Добавлен актив: ${parsed.name} — ${parsed.amount}`,
    snapshot: {
      id: entry.id,
      name: entry.name,
      amount: Number(entry.amount),
      date: entry.date,
    },
  });

  revalidateAll();
  return entry;
}

export async function updateAssetEntry(id: string, data: unknown) {
  const parsed = AssetEntrySchema.parse(data);
  const old = await prisma.assetEntry.findUnique({ where: { id } });

  const entry = await prisma.assetEntry.update({
    where: { id },
    data: {
      name: parsed.name,
      amount: new Prisma.Decimal(parsed.amount),
      date: new Date(parsed.date),
    },
  });

  await logAction({
    action: "UPDATE",
    entity: "AssetEntry",
    entityId: id,
    description: `Обновлен актив: ${parsed.name} — ${parsed.amount}`,
    snapshot: {
      previous: old
        ? { id: old.id, name: old.name, amount: Number(old.amount), date: old.date }
        : null,
    },
  });

  revalidateAll();
  return entry;
}

export async function deleteAssetEntry(id: string) {
  const old = await prisma.assetEntry.findUnique({ where: { id } });
  await prisma.assetEntry.delete({ where: { id } });

  const logId = await logAction({
    action: "DELETE",
    entity: "AssetEntry",
    entityId: id,
    description: `Удален актив: ${old?.name || id}`,
    snapshot: {
      deletedRecord: old
        ? { id: old.id, name: old.name, amount: Number(old.amount), date: old.date }
        : null,
    },
  });

  revalidateAll();
  return { logId };
}
