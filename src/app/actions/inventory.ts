"use server";

import { prisma } from "@/lib/db";
import {
  ProductionSchema,
  RestockSchema,
  WriteOffSchema,
  BonusSchema,
  RecipeSchema,
  InventoryItemSchema,
} from "@/lib/validations";
import { revalidateAll } from "@/lib/revalidate";
import { Prisma } from "@prisma/client";
import { logAction } from "./audit";
import { REAL_ITEMS_FILTER } from "@/lib/constants";

export async function getInventoryByCategory() {
  const items = await prisma.inventoryItem.findMany({
    where: REAL_ITEMS_FILTER,
    orderBy: { name: "asc" },
  });

  const groups: Record<string, typeof items> = {
    FINISHED_GOOD: [],
    RAW_MATERIAL: [],
    PACKAGING: [],
  };

  for (const item of items) {
    groups[item.category].push(item);
  }

  return groups;
}

export async function getFinishedGoodsMovementBreakdown(options?: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const items = await prisma.inventoryItem.findMany({
    where: {
      category: "FINISHED_GOOD",
      ...REAL_ITEMS_FILTER,
    },
    include: {
      stockMovements: {
        orderBy: { date: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const hasFrom = !!options?.dateFrom;
  const hasTo = !!options?.dateTo;
  const fromDate = hasFrom ? new Date(options!.dateFrom!) : null;
  const toDate = hasTo ? new Date(options!.dateTo!) : null;
  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }

  return items.map((item) => {
    const currentQty = Number(item.quantity);

    let productionIn = 0;
    let returnIn = 0;
    let defect = 0;
    let bonus = 0;
    let saleOut = 0;

    // Changes that occurred AFTER the period end (toDate), to roll back currentQty to closingBalance
    let afterPeriodNetChange = 0;

    for (const mov of item.stockMovements) {
      const movDate = new Date(mov.date);
      const absQty = Math.abs(Number(mov.quantity));

      const isAfterToDate = toDate && movDate > toDate;
      const isInPeriod = (!fromDate || movDate >= fromDate) && (!toDate || movDate <= toDate);

      if (isAfterToDate) {
        if (mov.type === "PRODUCTION_IN" || mov.type === "RETURN_IN") {
          afterPeriodNetChange += absQty;
        } else if (
          mov.type === "SALE_OUT" ||
          mov.type === "DEFECT" ||
          mov.type === "BONUS" ||
          mov.type === "PRODUCTION_CONSUME"
        ) {
          afterPeriodNetChange -= absQty;
        } else if (mov.type === "ADJUSTMENT") {
          afterPeriodNetChange += Number(mov.quantity);
        }
      }

      if (isInPeriod) {
        if (mov.type === "PRODUCTION_IN") {
          productionIn += absQty;
        } else if (mov.type === "RETURN_IN") {
          returnIn += absQty;
        } else if (mov.type === "DEFECT") {
          defect += absQty;
        } else if (mov.type === "BONUS") {
          bonus += absQty;
        } else if (mov.type === "SALE_OUT") {
          saleOut += absQty;
        } else if (mov.type === "ADJUSTMENT") {
          if (Number(mov.quantity) < 0) {
            defect += absQty;
          } else {
            productionIn += absQty;
          }
        }
      }
    }

    // Closing balance as of toDate
    const closingBalance = Math.max(0, currentQty - afterPeriodNetChange);

    // Period net change: inflows - outflows
    const periodNetChange = productionIn + returnIn - defect - bonus - saleOut;

    // Opening balance at start of period
    const openingBalance = Math.max(0, closingBalance - periodNetChange);

    const minStock = Number(item.minStock);
    const isLowStock = minStock > 0 && closingBalance <= minStock;

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      costPrice: Number(item.costPrice),
      salePrice: item.salePrice ? Number(item.salePrice) : null,
      minStock,
      openingBalance,
      productionIn,
      returnIn,
      defect,
      bonus,
      saleOut,
      closingBalance,
      isLowStock,
    };
  });
}

export async function getInventoryItem(id: string) {
  return prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      recipeLines: { include: { ingredient: true } },
      stockMovements: {
        orderBy: { date: "desc" },
        take: 50,
      },
    },
  });
}

export async function getAllItems() {
  return prisma.inventoryItem.findMany({
    where: REAL_ITEMS_FILTER,
    orderBy: { name: "asc" },
  });
}

export async function createInventoryItem(data: unknown) {
  const parsed = InventoryItemSchema.parse(data);

  const item = await prisma.inventoryItem.create({
    data: {
      name: parsed.name,
      category: parsed.category,
      unit: parsed.unit,
      costPrice: new Prisma.Decimal(parsed.costPrice),
      salePrice: parsed.salePrice ? new Prisma.Decimal(parsed.salePrice) : null,
      minStock: parsed.minStock ? new Prisma.Decimal(parsed.minStock) : new Prisma.Decimal(0),
    },
  });

  await logAction({
    action: "CREATE",
    entity: "InventoryItem",
    entityId: item.id,
    description: `Создан товар: ${parsed.name} (${parsed.category})`,
    snapshot: { id: item.id, name: item.name },
  });

  revalidateAll();
  return item;
}

export async function updateInventoryItem(id: string, data: unknown) {
  const parsed = InventoryItemSchema.parse(data);
  const oldItem = await prisma.inventoryItem.findUnique({ where: { id } });

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: parsed.name,
      category: parsed.category,
      unit: parsed.unit,
      costPrice: new Prisma.Decimal(parsed.costPrice),
      salePrice: parsed.salePrice ? new Prisma.Decimal(parsed.salePrice) : null,
      minStock: parsed.minStock ? new Prisma.Decimal(parsed.minStock) : new Prisma.Decimal(0),
    },
  });

  await logAction({
    action: "UPDATE",
    entity: "InventoryItem",
    entityId: id,
    description: `Обновлён товар: ${parsed.name}`,
    snapshot: {
      previous: oldItem
        ? {
            name: oldItem.name,
            unit: oldItem.unit,
            costPrice: Number(oldItem.costPrice),
            salePrice: oldItem.salePrice ? Number(oldItem.salePrice) : null,
            minStock: Number(oldItem.minStock),
          }
        : null,
    },
  });

  revalidateAll();
  return item;
}

/**
 * Produce a finished good: add stock and auto-deduct raw materials
 * via recipe lines. Supports explicit date selection.
 */
export async function produceItem(data: unknown) {
  const parsed = ProductionSchema.parse(data);
  const qty = Number(parsed.quantity);
  const movDate = parsed.date ? new Date(parsed.date) : new Date();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: parsed.itemId },
      include: { recipeLines: { include: { ingredient: true } } },
    });

    if (!item) throw new Error("Товар не найден");
    if (item.category !== "FINISHED_GOOD") {
      throw new Error("Производство доступно только для готовой продукции");
    }

    // Add finished good stock
    await tx.inventoryItem.update({
      where: { id: parsed.itemId },
      data: { quantity: { increment: new Prisma.Decimal(qty) } },
    });

    await tx.stockMovement.create({
      data: {
        itemId: parsed.itemId,
        type: "PRODUCTION_IN",
        quantity: new Prisma.Decimal(qty),
        date: movDate,
        note: `Производство ${qty} ${item.unit}`,
      },
    });

    // Auto-deduct raw materials via recipe
    for (const line of item.recipeLines) {
      const consumeQty = Number(line.qtyPerUnit) * qty;

      if (Number(line.ingredient.quantity) < consumeQty) {
        throw new Error(
          `Недостаточно "${line.ingredient.name}": нужно ${consumeQty} ${line.ingredient.unit}, есть ${line.ingredient.quantity}`
        );
      }

      await tx.inventoryItem.update({
        where: { id: line.ingredientId },
        data: {
          quantity: { decrement: new Prisma.Decimal(consumeQty) },
        },
      });

      await tx.stockMovement.create({
        data: {
          itemId: line.ingredientId,
          type: "PRODUCTION_CONSUME",
          quantity: new Prisma.Decimal(-consumeQty),
          date: movDate,
          note: `Расход на "${item.name}" × ${qty}`,
        },
      });
    }
  });

  await logAction({
    action: "PRODUCE",
    entity: "InventoryItem",
    entityId: parsed.itemId,
    description: `Произведено ${qty} шт. (${movDate.toISOString().split("T")[0]})`,
  });

  revalidateAll();
}

/**
 * Restock raw material or packaging. Supports explicit date selection.
 */
export async function restockItem(data: unknown) {
  const parsed = RestockSchema.parse(data);
  const qty = Number(parsed.quantity);
  const movDate = parsed.date ? new Date(parsed.date) : new Date();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: parsed.itemId },
    });
    if (!item) throw new Error("Товар не найден");

    await tx.inventoryItem.update({
      where: { id: parsed.itemId },
      data: { quantity: { increment: new Prisma.Decimal(qty) } },
    });

    await tx.stockMovement.create({
      data: {
        itemId: parsed.itemId,
        type: item.category === "FINISHED_GOOD" ? "PRODUCTION_IN" : "ADJUSTMENT",
        quantity: new Prisma.Decimal(qty),
        date: movDate,
        note: "Приход",
      },
    });
  });

  await logAction({
    action: "RESTOCK",
    entity: "InventoryItem",
    entityId: parsed.itemId,
    description: `Приход ${qty} шт. (${movDate.toISOString().split("T")[0]})`,
  });

  revalidateAll();
}

/**
 * Write off items (defect, adjustment). Supports explicit date selection.
 */
export async function writeOffItem(data: unknown) {
  const parsed = WriteOffSchema.parse(data);
  const qty = Number(parsed.quantity);
  const movDate = parsed.date ? new Date(parsed.date) : new Date();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: parsed.itemId },
    });
    if (!item) throw new Error("Товар не найден");
    if (Number(item.quantity) < qty) {
      throw new Error(`Недостаточно товара на складе: доступно ${item.quantity}, запрошено ${qty}`);
    }

    await tx.inventoryItem.update({
      where: { id: parsed.itemId },
      data: { quantity: { decrement: new Prisma.Decimal(qty) } },
    });

    await tx.stockMovement.create({
      data: {
        itemId: parsed.itemId,
        type: parsed.reason,
        quantity: new Prisma.Decimal(-qty),
        date: movDate,
        note: parsed.note || (parsed.reason === "DEFECT" ? "Брак" : "Корректировка"),
      },
    });
  });

  await logAction({
    action: "WRITE_OFF",
    entity: "InventoryItem",
    entityId: parsed.itemId,
    description: `Списание ${qty} шт. (${parsed.reason === "DEFECT" ? "Брак" : "Корректировка"})`,
  });

  revalidateAll();
}

/**
 * Warehouse bonus/sample operation (freebie given directly from warehouse).
 * Decrements inventory with no price/debt effect, records recipient name in note.
 */
export async function createBonusItem(data: unknown) {
  const parsed = BonusSchema.parse(data);
  const qty = Number(parsed.quantity);
  const movDate = parsed.date ? new Date(parsed.date) : new Date();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: parsed.itemId },
    });
    if (!item) throw new Error("Товар не найден");
    if (Number(item.quantity) < qty) {
      throw new Error(`Недостаточно товара на складе: доступно ${item.quantity}, запрошено ${qty}`);
    }

    await tx.inventoryItem.update({
      where: { id: parsed.itemId },
      data: { quantity: { decrement: new Prisma.Decimal(qty) } },
    });

    await tx.stockMovement.create({
      data: {
        itemId: parsed.itemId,
        type: "BONUS",
        quantity: new Prisma.Decimal(-qty),
        date: movDate,
        note: `Бонус: ${parsed.recipient}${parsed.note ? ` — ${parsed.note}` : ""}`,
      },
    });
  });

  await logAction({
    action: "WRITE_OFF",
    entity: "InventoryItem",
    entityId: parsed.itemId,
    description: `Бонус/Образец: ${qty} шт. получателю "${parsed.recipient}"`,
  });

  revalidateAll();
}

/**
 * Update recipe for a finished good
 */
export async function updateRecipe(data: unknown) {
  const parsed = RecipeSchema.parse(data);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.recipeLine.deleteMany({
      where: { productId: parsed.productId },
    });

    for (const line of parsed.lines) {
      await tx.recipeLine.create({
        data: {
          productId: parsed.productId,
          ingredientId: line.ingredientId,
          qtyPerUnit: new Prisma.Decimal(line.qtyPerUnit),
        },
      });
    }
  });

  revalidateAll();
}

export async function getRecipe(productId: string) {
  return prisma.recipeLine.findMany({
    where: { productId },
    include: { ingredient: true },
  });
}

export async function getLowStockItems() {
  const items = await prisma.inventoryItem.findMany({
    where: {
      minStock: { gt: 0 },
      ...REAL_ITEMS_FILTER,
    },
    orderBy: { name: "asc" },
  });

  return items.filter((item) => Number(item.quantity) < Number(item.minStock));
}
