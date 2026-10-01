"use server";

import { prisma } from "@/lib/db";
import { revalidateAll } from "@/lib/revalidate";
import { Prisma } from "@prisma/client";

export async function logAction(data: {
  action: string;
  entity: string;
  entityId?: string;
  description: string;
  snapshot?: any;
}) {
  try {
    const cleanSnapshot = data.snapshot != null ? JSON.parse(JSON.stringify(data.snapshot)) : undefined;

    await prisma.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        description: data.description,
        snapshot: cleanSnapshot,
      },
    });
  } catch (e) {
    // Audit logging should never break the main operation
    console.error("Audit log error:", e);
  }
}

export async function getAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Undo an operation recorded in AuditLog.
 * High-value entities supported: Sale, Payment, FinanceEntry, Client, LiabilityEntry, AssetEntry, ExpenseCategory, InventoryItem.
 */
export async function undoAction(logId: string) {
  const log = await prisma.auditLog.findUnique({
    where: { id: logId },
  });

  if (!log) {
    throw new Error("Запись журнала не найдена");
  }

  if (log.action === "UNDO") {
    throw new Error("Нельзя отменить операцию отмены");
  }

  const { action, entity, entityId, snapshot } = log;

  // ─── 1. UNDO CREATE (Reverse creation by deleting record & its side effects) ──
  if (action === "CREATE") {
    if (!entityId) {
      throw new Error("Отсутствует ID сущности для отмены создания");
    }

    if (entity === "Payment") {
      // Reversal of payment: delete Payment and linked FinanceEntry in same transaction
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { id: entityId } });
        if (!payment) return;

        // Delete linked finance entry
        await tx.financeEntry.deleteMany({
          where: {
            OR: [
              { relatedPaymentId: entityId },
              {
                relatedClientId: payment.clientId,
                amount: payment.amount,
                category: "DEBT_PAYMENT",
              },
            ],
          },
        });

        await tx.payment.delete({ where: { id: entityId } });
      });
    } else if (entity === "Sale") {
      // Reversal of sale: restore stock, delete stock movements, finance entries, sale items, sale
      await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id: entityId },
          include: { items: true },
        });
        if (!sale) return;

        const isSale = sale.type === "SALE";
        for (const item of sale.items) {
          const reverseQty = isSale
            ? Math.abs(Number(item.quantity))
            : -Math.abs(Number(item.quantity));

          await tx.inventoryItem.update({
            where: { id: item.productId },
            data: { quantity: { increment: new Prisma.Decimal(reverseQty) } },
          });
        }

        await tx.stockMovement.deleteMany({
          where: { note: { contains: sale.id.slice(-6) } },
        });

        await tx.financeEntry.deleteMany({
          where: { relatedSaleId: entityId },
        });

        await tx.saleItem.deleteMany({
          where: { saleId: entityId },
        });

        await tx.sale.delete({
          where: { id: entityId },
        });
      });
    } else if (entity === "FinanceEntry") {
      // Reversal of finance entry: if linked to a payment, delete payment too
      await prisma.$transaction(async (tx) => {
        const entry = await tx.financeEntry.findUnique({ where: { id: entityId } });
        if (!entry) return;

        if (entry.relatedSaleId) {
          throw new Error("Нельзя удалить запись, созданную продажей — отмените саму продажу");
        }

        let paymentId = entry.relatedPaymentId;
        if (!paymentId && entry.category === "DEBT_PAYMENT" && entry.relatedClientId) {
          const match = await tx.payment.findFirst({
            where: {
              clientId: entry.relatedClientId,
              amount: entry.amount,
            },
            orderBy: { id: "desc" },
          });
          if (match) paymentId = match.id;
        }

        if (paymentId) {
          await tx.payment.delete({ where: { id: paymentId } });
        }

        await tx.financeEntry.delete({ where: { id: entityId } });
      });
    } else if (entity === "Client") {
      // Delete client only if no remaining transaction history
      const [salesCount, paymentsCount] = await Promise.all([
        prisma.sale.count({ where: { clientId: entityId } }),
        prisma.payment.count({ where: { clientId: entityId } }),
      ]);
      if (salesCount > 0 || paymentsCount > 0) {
        throw new Error("Невозможно удалить клиента с существующими продажами или оплатами");
      }
      await prisma.client.delete({ where: { id: entityId } });
    } else if (entity === "LiabilityEntry") {
      await prisma.liabilityEntry.delete({ where: { id: entityId } });
    } else if (entity === "AssetEntry") {
      await prisma.assetEntry.delete({ where: { id: entityId } });
    } else if (entity === "ExpenseCategory") {
      await prisma.expenseCategory.delete({ where: { id: entityId } });
    } else if (entity === "InventoryItem") {
      const movements = await prisma.stockMovement.count({ where: { itemId: entityId } });
      if (movements > 0) {
        throw new Error("Нельзя удалить товар, по которому есть движения на складе");
      }
      await prisma.inventoryItem.delete({ where: { id: entityId } });
    } else {
      throw new Error(`Отмена создания для сущности "${entity}" не поддерживается`);
    }
  }

  // ─── 2. UNDO UPDATE (Restore previous snapshot) ──────────────────────────
  else if (action === "UPDATE") {
    if (!entityId || !snapshot) {
      throw new Error("Недостаточно данных снимка для отмены обновления");
    }

    const snap = snapshot as any;
    const prev = snap.previous || snap;

    if (entity === "Client") {
      await prisma.client.update({
        where: { id: entityId },
        data: {
          name: prev.name,
          phone: prev.phone || null,
          address: prev.address || null,
          district: prev.district || null,
          visitFrequency: prev.visitFrequency || null,
        },
      });
    } else if (entity === "InventoryItem") {
      await prisma.inventoryItem.update({
        where: { id: entityId },
        data: {
          name: prev.name,
          unit: prev.unit,
          costPrice: new Prisma.Decimal(prev.costPrice || 0),
          salePrice: prev.salePrice ? new Prisma.Decimal(prev.salePrice) : null,
          minStock: new Prisma.Decimal(prev.minStock || 0),
        },
      });
    } else if (entity === "LiabilityEntry") {
      await prisma.liabilityEntry.update({
        where: { id: entityId },
        data: {
          name: prev.name,
          amount: new Prisma.Decimal(prev.amount),
          date: new Date(prev.date),
        },
      });
    } else if (entity === "AssetEntry") {
      await prisma.assetEntry.update({
        where: { id: entityId },
        data: {
          name: prev.name,
          amount: new Prisma.Decimal(prev.amount),
          date: new Date(prev.date),
        },
      });
    } else if (entity === "ExpenseCategory") {
      await prisma.expenseCategory.update({
        where: { id: entityId },
        data: { name: prev.name },
      });
    } else {
      throw new Error(`Отмена обновления для сущности "${entity}" не поддерживается`);
    }
  }

  // ─── 3. UNDO DELETE (Recreate record from snapshot) ──────────────────────
  else if (action === "DELETE") {
    if (!snapshot) {
      throw new Error("Недостаточно данных снимка для восстановления удаленной записи");
    }

    const snap = snapshot as any;
    const deleted = snap.deletedRecord || snap;

    if (entity === "FinanceEntry") {
      await prisma.financeEntry.create({
        data: {
          id: deleted.id,
          date: new Date(deleted.date),
          type: deleted.type,
          description: deleted.description,
          amount: new Prisma.Decimal(deleted.amount),
          category: deleted.category || null,
          expenseCategoryId: deleted.expenseCategoryId || null,
          paymentMethod: deleted.paymentMethod || null,
          relatedClientId: deleted.relatedClientId || null,
        },
      });
    } else if (entity === "LiabilityEntry") {
      await prisma.liabilityEntry.create({
        data: {
          id: deleted.id,
          name: deleted.name,
          amount: new Prisma.Decimal(deleted.amount),
          date: new Date(deleted.date),
        },
      });
    } else if (entity === "AssetEntry") {
      await prisma.assetEntry.create({
        data: {
          id: deleted.id,
          name: deleted.name,
          amount: new Prisma.Decimal(deleted.amount),
          date: new Date(deleted.date),
        },
      });
    } else if (entity === "Client") {
      await prisma.client.create({
        data: {
          id: deleted.id,
          name: deleted.name,
          phone: deleted.phone || null,
          address: deleted.address || null,
          district: deleted.district || null,
          visitFrequency: deleted.visitFrequency || null,
        },
      });
    } else if (entity === "ExpenseCategory") {
      await prisma.expenseCategory.create({
        data: {
          id: deleted.id,
          name: deleted.name,
        },
      });
    } else {
      throw new Error(`Восстановление удаленной сущности "${entity}" не поддерживается`);
    }
  } else {
    throw new Error(`Действие "${action}" не подлежит отмене`);
  }

  // Log the undo action itself
  await logAction({
    action: "UNDO",
    entity: log.entity,
    entityId: log.entityId || undefined,
    description: `Отменено действие: ${log.action} ${log.entity} (${log.description})`,
  });

  revalidateAll();
}
