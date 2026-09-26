"use server";

import { prisma } from "@/lib/db";
import {
  ProductionSchema,
  RestockSchema,
  WriteOffSchema,
  RecipeSchema,
  InventoryItemSchema,
} from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { logAction } from "./audit";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

const REAL_ITEMS_FILTER: Prisma.InventoryItemWhereInput = {
  isSystem: false,
  NOT: { name: "__OPENING_BALANCE__" },
};

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
    let openingBalance = currentQty;

    let productionIn = 0;
    let returnIn = 0;
    let defect = 0;
    let bonus = 0;
    let saleOut = 0;

    for (const mov of item.stockMovements) {
      const movDate = new Date(mov.date);
      const movQty = Number(mov.quantity);

      // Movements on or after fromDate reversed from current quantity to calculate opening balance
      if (fromDate && movDate >= fromDate) {
        if (mov.type === "PRODUCTION_IN" || mov.type === "RETURN_IN") {
          openingBalance -= movQty;
        } else if (
          mov.type === "SALE_OUT" ||
          mov.type === "DEFECT" ||
          mov.type === "BONUS" ||
          mov.type === "PRODUCTION_CONSUME"
        ) {
          openingBalance += movQty;
        } else if (mov.type === "ADJUSTMENT") {
          openingBalance -= movQty;
        }
      }

      // Check if movement falls within [fromDate, toDate]
      const isInPeriod =
        (!fromDate || movDate >= fromDate) && (!toDate || movDate <= toDate);

      if (isInPeriod) {
        if (mov.type === "PRODUCTION_IN") {
          productionIn += movQty;
        } else if (mov.type === "RETURN_IN") {
          returnIn += movQty;
        } else if (mov.type === "DEFECT") {
          defect += movQty;
        } else if (mov.type === "BONUS") {
          bonus += movQty;
        } else if (mov.type === "SALE_OUT") {
          saleOut += movQty;
        }
      }
    }

    if (!fromDate) {
      openingBalance = currentQty - (productionIn + returnIn - defect - bonus - saleOut);
      if (openingBalance < 0) openingBalance = 0;
    }

    const closingBalance = openingBalance + productionIn + returnIn - defect - bonus - saleOut;
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

  await prisma.inventoryItem.create({
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
    description: `Создан товар: ${parsed.name} (${parsed.category})`,
  });

  safeRevalidate("/warehouse");
}

export async function updateInventoryItem(id: string, data: unknown) {
  const parsed = InventoryItemSchema.parse(data);

  await prisma.inventoryItem.update({
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
  });

  safeRevalidate("/warehouse");
}

/**
 * Produce a finished good: add stock and auto-deduct raw materials
 * via recipe lines.
 */
export async function produceItem(data: unknown) {
  const parsed = ProductionSchema.parse(data);
  const qty = Number(parsed.quantity);

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
        date: new Date(),
        note: `Производство ${qty} ${item.unit}`,
      },
    });

    // Auto-deduct raw materials via recipe
    for (const line of item.recipeLines) {
      const consumeQty = Number(line.qtyPerUnit) * qty;

      // Check if enough raw material
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
          date: new Date(),
          note: `Расход на "${item.name}" × ${qty}`,
        },
      });
    }
  });

  await logAction({
    action: "PRODUCE",
    entity: "InventoryItem",
    entityId: parsed.itemId,
    description: `Произведено ${qty} шт.`,
  });

  safeRevalidate("/warehouse");
  safeRevalidate("/report");
}

/**
 * Restock raw material or packaging
 */
export async function restockItem(data: unknown) {
  const parsed = RestockSchema.parse(data);
  const qty = Number(parsed.quantity);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.inventoryItem.update({
      where: { id: parsed.itemId },
      data: { quantity: { increment: new Prisma.Decimal(qty) } },
    });

    await tx.stockMovement.create({
      data: {
        itemId: parsed.itemId,
        type: "ADJUSTMENT",
        quantity: new Prisma.Decimal(qty),
        date: new Date(),
        note: "Приход",
      },
    });
  });

  await logAction({
    action: "RESTOCK",
    entity: "InventoryItem",
    entityId: parsed.itemId,
    description: `Приход ${qty} шт.`,
  });

  safeRevalidate("/warehouse");
  safeRevalidate("/report");
}

/**
 * Write off items (defect, adjustment)
 */
export async function writeOffItem(data: unknown) {
  const parsed = WriteOffSchema.parse(data);
  const qty = Number(parsed.quantity);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.inventoryItem.update({
      where: { id: parsed.itemId },
      data: { quantity: { decrement: new Prisma.Decimal(qty) } },
    });

    await tx.stockMovement.create({
      data: {
        itemId: parsed.itemId,
        type: parsed.reason,
        quantity: new Prisma.Decimal(-qty),
        date: new Date(),
        note: parsed.note || (parsed.reason === "DEFECT" ? "Брак" : "Корректировка"),
      },
    });
  });

  await logAction({
    action: "WRITE_OFF",
    entity: "InventoryItem",
    entityId: parsed.itemId,
    description: `Списание ${qty} шт. (${parsed.reason})`,
  });

  safeRevalidate("/warehouse");
  safeRevalidate("/report");
}

/**
 * Update recipe for a finished good
 */
export async function updateRecipe(data: unknown) {
  const parsed = RecipeSchema.parse(data);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Delete existing recipe lines
    await tx.recipeLine.deleteMany({
      where: { productId: parsed.productId },
    });

    // Create new recipe lines
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

  safeRevalidate("/warehouse");
}

export async function getRecipe(productId: string) {
  return prisma.recipeLine.findMany({
    where: { productId },
    include: { ingredient: true },
  });
}

/**
 * Get items below their minimum stock level
 */
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
