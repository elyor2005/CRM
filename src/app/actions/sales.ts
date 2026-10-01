"use server";

import { prisma } from "@/lib/db";
import { SaleFormSchema } from "@/lib/validations";
import { revalidateAll } from "@/lib/revalidate";
import { Prisma } from "@prisma/client";
import { logAction } from "./audit";
import { REAL_ITEMS_FILTER } from "@/lib/constants";

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
    where: {
      category: "FINISHED_GOOD",
      ...REAL_ITEMS_FILTER,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Create a sale with all cascading effects:
 * - SaleItems
 * - StockMovements (SALE_OUT for sale, RETURN_IN for return) with recipient name in note
 * - FinanceEntry if payment > 0
 * - Update InventoryItem quantities
 */
export async function createSale(data: unknown) {
  const parsed = SaleFormSchema.parse(data);
  const isSale = parsed.type === "SALE";

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const client = await tx.client.findUnique({
      where: { id: parsed.clientId },
    });

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
      const movementQty = isSale
        ? -Math.abs(Number(item.quantity))
        : Math.abs(Number(item.quantity));

      await tx.stockMovement.create({
        data: {
          itemId: item.productId,
          type: movementType,
          quantity: new Prisma.Decimal(movementQty),
          date: new Date(parsed.date),
          note: `${isSale ? "Продажа" : "Возврат"} #${sale.id.slice(-6)} — ${client?.name || "клиент"}`,
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

    return { sale, clientName: client?.name };
  });

  await logAction({
    action: "CREATE",
    entity: "Sale",
    entityId: result.sale.id,
    description: `${parsed.type === "SALE" ? "Продажа" : "Возврат"} клиенту "${result.clientName || "клиент"}" на ${parsed.items.length} поз., оплата: ${parsed.payment}`,
    snapshot: {
      id: result.sale.id,
      clientId: parsed.clientId,
      type: parsed.type,
      date: parsed.date,
      payment: parsed.payment,
      items: parsed.items,
    },
  });

  revalidateAll();
  return result.sale;
}

/**
 * Delete a sale and reverse all its effects:
 * - Reverse stock movements
 * - Remove finance entries
 * - Restore inventory quantities
 */
export async function deleteSale(id: string) {
  let saleType = "SALE";
  let saleSnapshot: any = null;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) throw new Error("Продажа не найдена");
    saleType = sale.type;
    saleSnapshot = {
      id: sale.id,
      clientId: sale.clientId,
      type: sale.type,
      date: sale.date,
      payment: Number(sale.payment),
      items: sale.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
        isFreebie: i.isFreebie,
        freebieFor: i.freebieFor,
      })),
    };

    const isSale = sale.type === "SALE";

    // Reverse inventory quantities
    for (const item of sale.items) {
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

  const logId = await logAction({
    action: "DELETE",
    entity: "Sale",
    entityId: id,
    description: `Удалена ${saleType === "SALE" ? "продажа" : "возврат"} #${id.slice(-6)}`,
    snapshot: { deletedRecord: saleSnapshot },
  });

  revalidateAll();
  return { logId };
}

/**
 * Update a sale: reverse old effects, apply new ones (atomic).
 */
export async function updateSale(id: string, data: unknown) {
  const parsed = SaleFormSchema.parse(data);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const oldSale = await tx.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!oldSale) throw new Error("Продажа не найдена");

    const client = await tx.client.findUnique({
      where: { id: parsed.clientId },
    });

    const oldIsSale = oldSale.type === "SALE";

    // Reverse old inventory effects
    for (const item of oldSale.items) {
      const reverseQty = oldIsSale
        ? Math.abs(Number(item.quantity))
        : -Math.abs(Number(item.quantity));

      await tx.inventoryItem.update({
        where: { id: item.productId },
        data: {
          quantity: { increment: new Prisma.Decimal(reverseQty) },
        },
      });
    }

    // Delete old stock movements and finance entries
    await tx.stockMovement.deleteMany({
      where: { note: { contains: id.slice(-6) } },
    });
    await tx.financeEntry.deleteMany({
      where: { relatedSaleId: id },
    });
    await tx.saleItem.deleteMany({
      where: { saleId: id },
    });

    // Update sale record
    await tx.sale.update({
      where: { id },
      data: {
        date: new Date(parsed.date),
        type: parsed.type,
        clientId: parsed.clientId,
        payment: new Prisma.Decimal(parsed.payment),
      },
    });

    const isSale = parsed.type === "SALE";

    // Apply new items and movements
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
          note: `${isSale ? "Продажа" : "Возврат"} #${id.slice(-6)} — ${client?.name || "клиент"}`,
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

  revalidateAll();
}
