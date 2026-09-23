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

export async function getInventoryByCategory() {
  const items = await prisma.inventoryItem.findMany({
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
    },
  });

  revalidatePath("/warehouse");
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
    },
  });

  revalidatePath("/warehouse");
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

  revalidatePath("/warehouse");
  revalidatePath("/report");
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

  revalidatePath("/warehouse");
  revalidatePath("/report");
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

  revalidatePath("/warehouse");
  revalidatePath("/report");
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

  revalidatePath("/warehouse");
}

export async function getRecipe(productId: string) {
  return prisma.recipeLine.findMany({
    where: { productId },
    include: { ingredient: true },
  });
}
