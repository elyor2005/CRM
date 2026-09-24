"use server";

import { prisma } from "@/lib/db";
import { SaleFormSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { logAction } from "./audit";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

export async function getSales() {
  return prisma.sale.findMany({
    include: {
      client: true,
      items: { include: { product: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });
}

export async function getSale(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: {
      client: true,
      items: { include: { product: true } },
      finance: true,
    },
  });
}

export async function getProducts() {
  return prisma.inventoryItem.findMany({
    where: { category: "FINISHED_GOOD" },
    orderBy: { name: "asc" },
  });
}

/**
 * Create a sale with all cascading effects:
 * - SaleItems
 * - StockMovements (SALE_OUT for sale, RETURN_IN for return)
 * - FinanceEntry if payment > 0
 * - Update InventoryItem quantities
 */
export async function createSale(data: unknown) {
  const parsed = SaleFormSchema.parse(data);
  const isSale = parsed.type === "SALE";

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create the sale
    const sale = await tx.sale.create({
      data: {
        date: new Date(parsed.date),
        type: parsed.type,
        clientId: parsed.clientId,
        payment: new Prisma.Decimal(parsed.payment),
      },
    });

    // Create sale items and stock movements
    for (const item of parsed.items) {
      const product = await tx.inventoryItem.findUnique({
        where: { id: item.productId },
      });
      if (!product) throw new Error("Товар не найден");

      if (isSale && Number(product.quantity) < Number(item.quantity)) {
        throw new Error(
          `Недостаточно товара "${product.name}": на складе ${product.quantity} ${product.unit}, запрошено ${item.quantity}`
        );
      }

      const unitPrice = item.isFreebie ? "0" : item.unitPrice;
      const lineTotal = item.isFreebie
        ? "0"
        : String(Number(item.quantity) * Number(item.unitPrice));

      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(unitPrice),
          lineTotal: new Prisma.Decimal(lineTotal),
          isFreebie: item.isFreebie,
          freebieFor: item.isFreebie ? item.freebieFor || null : null,
        },
      });

      // Stock movement
      const movementType = isSale ? "SALE_OUT" : "RETURN_IN";
      // SALE_OUT is negative quantity, RETURN_IN is positive
      const movementQty = isSale
        ? -Math.abs(Number(item.quantity))
        : Math.abs(Number(item.quantity));

      await tx.stockMovement.create({
        data: {
          itemId: item.productId,
          type: movementType,
          quantity: new Prisma.Decimal(movementQty),
          date: new Date(parsed.date),
          note: `${isSale ? "Продажа" : "Возврат"} #${sale.id.slice(-6)}`,
        },
      });

      // Update inventory quantity
      await tx.inventoryItem.update({
        where: { id: item.productId },
        data: {
          quantity: {
            increment: new Prisma.Decimal(movementQty),
          },
        },
      });
    }

    // Finance entry if payment > 0
    if (Number(parsed.payment) > 0) {
      const client = await tx.client.findUnique({
        where: { id: parsed.clientId },
      });

      await tx.financeEntry.create({
        data: {
          date: new Date(parsed.date),
          type: "INCOME",
          description: `Оплата от ${client?.name || "клиента"} (${isSale ? "продажа" : "возврат"})`,
          amount: new Prisma.Decimal(parsed.payment),
          relatedClientId: parsed.clientId,
          relatedSaleId: sale.id,
          paymentMethod: "CASH",
        },
      });
    }

    return sale;
  });

  await logAction({
    action: "CREATE",
    entity: "Sale",
    entityId: result.id,
    description: `${parsed.type === "SALE" ? "Продажа" : "Возврат"} на ${parsed.items.length} поз., оплата: ${parsed.payment}`,
  });

  safeRevalidate("/sales");
  safeRevalidate("/debts");
  safeRevalidate("/finance");
  safeRevalidate("/warehouse");
  safeRevalidate("/report");
  return result;
}

/**
 * Delete a sale and reverse all its effects:
 * - Reverse stock movements
 * - Remove finance entries
 * - Restore inventory quantities
 */
export async function deleteSale(id: string) {
  let saleType = "SALE";
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) throw new Error("Продажа не найдена");
    saleType = sale.type;

    const isSale = sale.type === "SALE";

    // Reverse inventory changes
    for (const item of sale.items) {
      // Reverse: if it was SALE_OUT (-qty), we add it back
      const reverseQty = isSale
        ? Math.abs(Number(item.quantity))
        : -Math.abs(Number(item.quantity));

      await tx.inventoryItem.update({
        where: { id: item.productId },
        data: {
          quantity: { increment: new Prisma.Decimal(reverseQty) },
        },
      });
    }

    // Delete stock movements for this sale
    await tx.stockMovement.deleteMany({
      where: {
        note: { contains: sale.id.slice(-6) },
      },
    });

    // Delete finance entries linked to this sale
    await tx.financeEntry.deleteMany({
      where: { relatedSaleId: id },
    });

    // Delete sale items
    await tx.saleItem.deleteMany({
      where: { saleId: id },
    });

    // Delete the sale itself
    await tx.sale.delete({
      where: { id },
    });
  });

  await logAction({
    action: "DELETE",
    entity: "Sale",
    entityId: id,
    description: `Удалена ${saleType === "SALE" ? "продажа" : "возврат"} #${id.slice(-6)}`,
  });

  safeRevalidate("/sales");
  safeRevalidate("/debts");
  safeRevalidate("/finance");
  safeRevalidate("/warehouse");
  safeRevalidate("/report");
}

/**
 * Update a sale: reverse old effects, apply new ones (atomic).
 */
export async function updateSale(id: string, data: unknown) {
  const parsed = SaleFormSchema.parse(data);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Get old sale and reverse its effects
    const oldSale = await tx.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!oldSale) throw new Error("Продажа не найдена");

    const wasIsSale = oldSale.type === "SALE";

    // Reverse old inventory changes
    for (const item of oldSale.items) {
      const reverseQty = wasIsSale
        ? Math.abs(Number(item.quantity))
        : -Math.abs(Number(item.quantity));

      await tx.inventoryItem.update({
        where: { id: item.productId },
        data: {
          quantity: { increment: new Prisma.Decimal(reverseQty) },
        },
      });
    }

    // Delete old stock movements
    await tx.stockMovement.deleteMany({
      where: { note: { contains: oldSale.id.slice(-6) } },
    });

    // Delete old finance entries
    await tx.financeEntry.deleteMany({
      where: { relatedSaleId: id },
    });

    // Delete old sale items
    await tx.saleItem.deleteMany({
      where: { saleId: id },
    });

    // 2. Update the sale record
    const isSale = parsed.type === "SALE";

    await tx.sale.update({
      where: { id },
      data: {
        date: new Date(parsed.date),
        type: parsed.type,
        clientId: parsed.clientId,
        payment: new Prisma.Decimal(parsed.payment),
      },
    });

    // 3. Apply new effects
    for (const item of parsed.items) {
      const unitPrice = item.isFreebie ? "0" : item.unitPrice;
      const lineTotal = item.isFreebie
        ? "0"
        : String(Number(item.quantity) * Number(item.unitPrice));

      await tx.saleItem.create({
        data: {
          saleId: id,
          productId: item.productId,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(unitPrice),
          lineTotal: new Prisma.Decimal(lineTotal),
          isFreebie: item.isFreebie,
          freebieFor: item.isFreebie ? item.freebieFor || null : null,
        },
      });

      const movementQty = isSale
        ? -Math.abs(Number(item.quantity))
        : Math.abs(Number(item.quantity));

      await tx.stockMovement.create({
        data: {
          itemId: item.productId,
          type: isSale ? "SALE_OUT" : "RETURN_IN",
          quantity: new Prisma.Decimal(movementQty),
          date: new Date(parsed.date),
          note: `${isSale ? "Продажа" : "Возврат"} #${id.slice(-6)}`,
        },
      });

      await tx.inventoryItem.update({
        where: { id: item.productId },
        data: {
          quantity: { increment: new Prisma.Decimal(movementQty) },
        },
      });
    }

    if (Number(parsed.payment) > 0) {
      const client = await tx.client.findUnique({
        where: { id: parsed.clientId },
      });
      await tx.financeEntry.create({
        data: {
          date: new Date(parsed.date),
          type: "INCOME",
          description: `Оплата от ${client?.name || "клиента"} (${isSale ? "продажа" : "возврат"})`,
          amount: new Prisma.Decimal(parsed.payment),
          relatedClientId: parsed.clientId,
          relatedSaleId: id,
          paymentMethod: "CASH",
        },
      });
    }
  });

  await logAction({
    action: "UPDATE",
    entity: "Sale",
    entityId: id,
    description: `Изменена ${parsed.type === "SALE" ? "продажа" : "возврат"} #${id.slice(-6)}`,
  });

  safeRevalidate("/sales");
  safeRevalidate("/debts");
  safeRevalidate("/finance");
  safeRevalidate("/warehouse");
  safeRevalidate("/report");
}
