"use server";

import { prisma } from "@/lib/db";
import { ClientSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

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
    },
  });
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

      let totalSalesDebt = 0;
      let totalPaymentsOnSales = 0;
      let lastSaleDate: Date | null = null;
      let last30DaysSalesSum = 0;

      for (const sale of sales) {
        const saleTotal = sale.items.reduce(
          (sum, item) => sum + Number(item.lineTotal),
          0
        );

        if (sale.type === "SALE") {
          totalSalesDebt += saleTotal;
        } else {
          // RETURN reduces debt
          totalSalesDebt -= saleTotal;
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

      const debt = totalSalesDebt - totalPaymentsOnSales - totalStandalonePayments;

      return {
        ...client,
        debt,
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
