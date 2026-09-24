"use server";

import { prisma } from "@/lib/db";
import { FinanceEntryFormSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { logAction } from "./audit";

export async function getFinanceEntries(options?: {
  filter?: "INCOME" | "EXPENSE";
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Prisma.FinanceEntryWhereInput = {};

  if (options?.filter) {
    where.type = options.filter;
  }

  if (options?.dateFrom || options?.dateTo) {
    where.date = {};
    if (options.dateFrom) {
      where.date.gte = new Date(options.dateFrom);
    }
    if (options.dateTo) {
      // End of day
      const end = new Date(options.dateTo);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  return prisma.financeEntry.findMany({
    where,
    include: {
      relatedClient: true,
      relatedSale: true,
    },
    orderBy: { date: "desc" },
  });
}

export async function createFinanceEntry(data: unknown) {
  const parsed = FinanceEntryFormSchema.parse(data);

  const entry = await prisma.financeEntry.create({
    data: {
      date: new Date(parsed.date),
      type: parsed.type,
      description: parsed.description,
      amount: new Prisma.Decimal(parsed.amount),
      category: parsed.category || null,
      paymentMethod: parsed.paymentMethod || null,
    },
  });

  await logAction({
    action: "CREATE",
    entity: "FinanceEntry",
    entityId: entry.id,
    description: `${parsed.type === "INCOME" ? "Приход" : "Расход"}: ${parsed.description} — ${parsed.amount}`,
  });

  revalidatePath("/finance");
  revalidatePath("/report");
}

export async function deleteFinanceEntry(id: string) {
  // Only allow deleting manual entries (not linked to sales)
  const entry = await prisma.financeEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Запись не найдена");
  if (entry.relatedSaleId) {
    throw new Error("Нельзя удалить автоматическую запись, привязанную к продаже");
  }

  await prisma.financeEntry.delete({ where: { id } });

  await logAction({
    action: "DELETE",
    entity: "FinanceEntry",
    entityId: id,
    description: `Удалена запись: ${entry.description} — ${entry.amount}`,
  });

  revalidatePath("/finance");
  revalidatePath("/report");
}

export async function getCashBalance() {
  const income = await prisma.financeEntry.aggregate({
    where: { type: "INCOME" },
    _sum: { amount: true },
  });
  const expense = await prisma.financeEntry.aggregate({
    where: { type: "EXPENSE" },
    _sum: { amount: true },
  });
  return (
    Number(income._sum.amount || 0) - Number(expense._sum.amount || 0)
  );
}

export async function getFinanceSummary(options?: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const dateFilter: Prisma.FinanceEntryWhereInput = {};
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

  const [income, expense] = await Promise.all([
    prisma.financeEntry.aggregate({
      where: { type: "INCOME", ...dateFilter },
      _sum: { amount: true },
    }),
    prisma.financeEntry.aggregate({
      where: { type: "EXPENSE", ...dateFilter },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalIncome: Number(income._sum.amount || 0),
    totalExpense: Number(expense._sum.amount || 0),
    balance: Number(income._sum.amount || 0) - Number(expense._sum.amount || 0),
  };
}
