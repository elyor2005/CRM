"use server";

import { prisma } from "@/lib/db";
import { FinanceEntryFormSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export async function getFinanceEntries(filter?: "INCOME" | "EXPENSE") {
  const where = filter ? { type: filter } : {};

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

  await prisma.financeEntry.create({
    data: {
      date: new Date(parsed.date),
      type: parsed.type,
      description: parsed.description,
      amount: new Prisma.Decimal(parsed.amount),
    },
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
