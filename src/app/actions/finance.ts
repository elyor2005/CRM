"use server";

import { prisma } from "@/lib/db";
import { FinanceEntryFormSchema } from "@/lib/validations";
import { revalidateAll } from "@/lib/revalidate";
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

  let expenseCategoryId: string | null = null;
  if (parsed.category) {
    try {
      const cat = await prisma.expenseCategory.findUnique({
        where: { name: parsed.category },
      });
      if (cat) expenseCategoryId = cat.id;
    } catch {}
  }

  const entry = await prisma.financeEntry.create({
    data: {
      date: new Date(parsed.date),
      type: parsed.type,
      description: parsed.description,
      amount: new Prisma.Decimal(parsed.amount),
      category: parsed.category || null,
      expenseCategoryId,
      paymentMethod: parsed.paymentMethod || null,
    },
  });

  await logAction({
    action: "CREATE",
    entity: "FinanceEntry",
    entityId: entry.id,
    description: `${parsed.type === "INCOME" ? "Приход" : "Расход"}: ${parsed.description} — ${parsed.amount}`,
    snapshot: {
      id: entry.id,
      date: entry.date,
      type: entry.type,
      description: entry.description,
      amount: Number(entry.amount),
      category: entry.category,
      paymentMethod: entry.paymentMethod,
    },
  });

  revalidateAll();
  return entry;
}

export async function updateFinanceEntry(id: string, data: unknown) {
  const parsed = FinanceEntryFormSchema.parse(data);
  const old = await prisma.financeEntry.findUnique({ where: { id } });
  if (!old) throw new Error("Запись не найдена");
  if (old.relatedSaleId) {
    throw new Error("Нельзя редактировать автоматическую запись, привязанную к продаже");
  }

  let expenseCategoryId: string | null = null;
  if (parsed.category) {
    try {
      const cat = await prisma.expenseCategory.findUnique({
        where: { name: parsed.category },
      });
      if (cat) expenseCategoryId = cat.id;
    } catch {}
  }

  const entry = await prisma.financeEntry.update({
    where: { id },
    data: {
      date: new Date(parsed.date),
      type: parsed.type,
      description: parsed.description,
      amount: new Prisma.Decimal(parsed.amount),
      category: parsed.category || null,
      expenseCategoryId,
      paymentMethod: parsed.paymentMethod || null,
    },
  });

  await logAction({
    action: "UPDATE",
    entity: "FinanceEntry",
    entityId: id,
    description: `Обновлена запись: ${parsed.description} — ${parsed.amount}`,
    snapshot: {
      previous: {
        id: old.id,
        date: old.date,
        type: old.type,
        description: old.description,
        amount: Number(old.amount),
        category: old.category,
        paymentMethod: old.paymentMethod,
      },
    },
  });

  revalidateAll();
  return entry;
}

export async function deleteFinanceEntry(id: string) {
  // Only allow deleting manual entries (not linked to sales)
  const entry = await prisma.financeEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Запись не найдена");
  if (entry.relatedSaleId) {
    throw new Error("Нельзя удалить автоматическую запись, привязанную к продаже");
  }

  await prisma.$transaction(async (tx) => {
    // If this finance entry is linked to a Payment, reverse/delete that Payment in the same transaction!
    let paymentToDelete: string | null = null;
    if (entry.relatedPaymentId) {
      paymentToDelete = entry.relatedPaymentId;
    } else if (entry.category === "DEBT_PAYMENT" && entry.relatedClientId) {
      // Historical fallback matching for payments created before foreign key was added
      const match = await tx.payment.findFirst({
        where: {
          clientId: entry.relatedClientId,
          amount: entry.amount,
        },
        orderBy: { id: "desc" },
      });
      if (match) {
        paymentToDelete = match.id;
      }
    }

    if (paymentToDelete) {
      await tx.payment.delete({ where: { id: paymentToDelete } });
      await logAction({
        action: "DELETE",
        entity: "Payment",
        entityId: paymentToDelete,
        description: `Автоматически удалена оплата при удалении финансовой записи (${entry.amount})`,
      });
    }

    await tx.financeEntry.delete({ where: { id } });
  });

  const logId = await logAction({
    action: "DELETE",
    entity: "FinanceEntry",
    entityId: id,
    description: `Удалена запись: ${entry.description} — ${entry.amount}`,
    snapshot: {
      deletedRecord: {
        id: entry.id,
        date: entry.date,
        type: entry.type,
        description: entry.description,
        amount: Number(entry.amount),
        category: entry.category,
        paymentMethod: entry.paymentMethod,
        relatedClientId: entry.relatedClientId,
        relatedPaymentId: entry.relatedPaymentId,
      },
    },
  });

  revalidateAll();
  return { logId };
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

  const [income, expense, expenseEntries] = await Promise.all([
    prisma.financeEntry.aggregate({
      where: { type: "INCOME", ...dateFilter },
      _sum: { amount: true },
    }),
    prisma.financeEntry.aggregate({
      where: { type: "EXPENSE", ...dateFilter },
      _sum: { amount: true },
    }),
    prisma.financeEntry.findMany({
      where: { type: "EXPENSE", ...dateFilter },
      select: { category: true, amount: true },
    }),
  ]);

  const expenseByCategory: Record<string, number> = {};
  for (const entry of expenseEntries) {
    const cat = entry.category || "__UNCATEGORIZED__";
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(entry.amount);
  }

  return {
    totalIncome: Number(income._sum.amount || 0),
    totalExpense: Number(expense._sum.amount || 0),
    balance: Number(income._sum.amount || 0) - Number(expense._sum.amount || 0),
    expenseByCategory,
  };
}

// ─── Expense Categories CRUD ──────────────────────────────────────────────────

const DEFAULT_EXPENSE_CATEGORIES = [
  "Сырьё",
  "Упаковка",
  "Зарплата",
  "Транспорт",
  "Аренда",
  "Коммунальные",
  "Маркетинг",
  "Оборудование",
  "Прочее",
];

export async function getExpenseCategories() {
  try {
    const list = await prisma.expenseCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { financeEntries: true },
        },
      },
    });
    if (list.length > 0) {
      return list;
    }
  } catch (e) {
    console.warn("ExpenseCategory table not ready in DB, falling back to defaults:", e);
  }

  // Fallback defaults
  return DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({
    id: `def_${i}`,
    name,
    createdAt: new Date(),
    _count: { financeEntries: 0 },
  }));
}

export async function createExpenseCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Название категории не может быть пустым");

  const cat = await prisma.expenseCategory.create({
    data: { name: trimmed },
  });

  await logAction({
    action: "CREATE",
    entity: "ExpenseCategory",
    entityId: cat.id,
    description: `Создана категория расходов: ${trimmed}`,
    snapshot: { id: cat.id, name: cat.name },
  });

  revalidateAll();
  return cat;
}

export async function updateExpenseCategory(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Название категории не может быть пустым");

  const old = await prisma.expenseCategory.findUnique({ where: { id } });
  const cat = await prisma.expenseCategory.update({
    where: { id },
    data: { name: trimmed },
  });

  if (old) {
    await prisma.financeEntry.updateMany({
      where: {
        OR: [
          { expenseCategoryId: id },
          { category: old.name },
        ],
      },
      data: { category: trimmed },
    });
  }

  await logAction({
    action: "UPDATE",
    entity: "ExpenseCategory",
    entityId: id,
    description: `Изменена категория расходов: ${old?.name} -> ${trimmed}`,
    snapshot: { previous: { name: old?.name } },
  });

  revalidateAll();
  return cat;
}

export async function deleteExpenseCategory(id: string) {
  const cat = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!cat) throw new Error("Категория не найдена");

  const usedCount = await prisma.financeEntry.count({
    where: {
      OR: [
        { expenseCategoryId: id },
        { category: cat.name },
      ],
    },
  });

  if (usedCount > 0) {
    throw new Error(
      `Категория "${cat.name}" используется в ${usedCount} финансовых операциях. Удаление заблокировано во избежание потери данных.`
    );
  }

  await prisma.expenseCategory.delete({ where: { id } });

  await logAction({
    action: "DELETE",
    entity: "ExpenseCategory",
    entityId: id,
    description: `Удалена категория расходов: ${cat.name}`,
    snapshot: { deletedRecord: { id: cat.id, name: cat.name } },
  });

  revalidateAll();
}
