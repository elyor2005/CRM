"use server";

import { prisma } from "@/lib/db";
import { ClientSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { OPENING_BALANCE_ITEM_NAME } from "@/lib/constants";

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

export async function getClients(options?: { includeArchived?: boolean }) {
  return prisma.client.findMany({
    where: options?.includeArchived ? undefined : { isArchived: false },
    orderBy: { name: "asc" },
  });
}

export async function getClient(id: string) {
  return prisma.client.findUnique({
    where: { id },
  });
}

import { logAction } from "./audit";
import { revalidateAll } from "@/lib/revalidate";

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
    });
  }

  await logAction({
    action: "CREATE",
    entity: "Client",
    entityId: client.id,
    description: `Создан клиент: ${client.name}`,
    snapshot: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      address: client.address,
      district: client.district,
      visitFrequency: client.visitFrequency,
    },
  });

  revalidateAll();
  return client;
}

export async function updateClient(id: string, data: unknown) {
  const parsed = ClientSchema.parse(data);
  const oldClient = await prisma.client.findUnique({ where: { id } });

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

  await logAction({
    action: "UPDATE",
    entity: "Client",
    entityId: client.id,
    description: `Изменен клиент: ${client.name}`,
    snapshot: {
      previous: oldClient
        ? {
            name: oldClient.name,
            phone: oldClient.phone,
            address: oldClient.address,
            district: oldClient.district,
            visitFrequency: oldClient.visitFrequency,
          }
        : null,
    },
  });

  revalidateAll();
  return client;
}

export async function checkClientDeletionStatus(id: string): Promise<{
  canDelete: boolean;
  clientName: string;
  reason?: string;
}> {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    return { canDelete: false, clientName: "", reason: "Клиент не найден" };
  }

  const [salesCount, paymentsCount, financeCount] = await Promise.all([
    prisma.sale.count({ where: { clientId: id } }),
    prisma.payment.count({ where: { clientId: id } }),
    prisma.financeEntry.count({ where: { relatedClientId: id } }),
  ]);

  if (salesCount > 0 || paymentsCount > 0 || financeCount > 0) {
    return {
      canDelete: false,
      clientName: client.name,
      reason: `У клиента "${client.name}" есть история операций (продажи, оплаты или финансы). Удаление невозможно.`,
    };
  }

  return {
    canDelete: true,
    clientName: client.name,
  };
}

export async function deleteClient(id: string): Promise<{ logId?: string; error?: string }> {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return { error: "Клиент не найден" };

  // Check transaction history: Sales, Payments, FinanceEntries
  const [salesCount, paymentsCount, financeCount] = await Promise.all([
    prisma.sale.count({ where: { clientId: id } }),
    prisma.payment.count({ where: { clientId: id } }),
    prisma.financeEntry.count({ where: { relatedClientId: id } }),
  ]);

  if (salesCount > 0 || paymentsCount > 0 || financeCount > 0) {
    return {
      error: "У клиента есть история операций (продажи, оплаты или финансы). Удаление невозможно.",
    };
  }

  try {
    await prisma.client.delete({ where: { id } });
  } catch (e) {
    // Catch any unexpected FK constraint violations (e.g. race condition or schema drift)
    console.error("deleteClient Prisma error:", e);
    return {
      error: "Не удалось удалить клиента — возможно, есть связанные записи. Попробуйте позже.",
    };
  }

  const logId = await logAction({
    action: "DELETE",
    entity: "Client",
    entityId: id,
    description: `Удален клиент: ${client.name}`,
    snapshot: {
      deletedRecord: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        address: client.address,
        district: client.district,
        visitFrequency: client.visitFrequency,
      },
    },
  });

  revalidateAll();
  return { logId };
}


export async function archiveClient(id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new Error("Клиент не найден");

  await prisma.client.update({
    where: { id },
    data: {
      isArchived: true,
      archivedAt: new Date(),
    },
  });

  const logId = await logAction({
    action: "ARCHIVE",
    entity: "Client",
    entityId: id,
    description: `Архивирован клиент: ${client.name}`,
    snapshot: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      address: client.address,
      district: client.district,
      visitFrequency: client.visitFrequency,
      isArchived: false,
    },
  });

  revalidateAll();
  return { logId };
}

export async function unarchiveClient(id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new Error("Клиент не найден");

  await prisma.client.update({
    where: { id },
    data: {
      isArchived: false,
      archivedAt: null,
    },
  });

  const logId = await logAction({
    action: "UNARCHIVE",
    entity: "Client",
    entityId: id,
    description: `Восстановлен из архива клиент: ${client.name}`,
    snapshot: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      address: client.address,
      district: client.district,
      visitFrequency: client.visitFrequency,
      isArchived: true,
    },
  });

  revalidateAll();
  return { logId };
}

/**
 * Get all clients with their computed debt, last sale date,
 * and 30-day sales sum.
 */
export async function getClientsWithDebt(options?: { tab?: "ACTIVE" | "ARCHIVED" | "ALL" }) {
  const tab = options?.tab || "ACTIVE";
  const where: Prisma.ClientWhereInput = {};
  if (tab === "ACTIVE") {
    where.isArchived = false;
  } else if (tab === "ARCHIVED") {
    where.isArchived = true;
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      district: true,
      visitFrequency: true,
      isArchived: true,
      archivedAt: true,
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
