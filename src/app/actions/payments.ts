"use server";

import { prisma } from "@/lib/db";
import { PaymentFormSchema } from "@/lib/validations";
import { revalidateAll } from "@/lib/revalidate";
import { Prisma } from "@prisma/client";
import { logAction } from "./audit";

export async function createPayment(data: unknown) {
  const parsed = PaymentFormSchema.parse(data);

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create the payment
    const payment = await tx.payment.create({
      data: {
        clientId: parsed.clientId,
        amount: new Prisma.Decimal(parsed.amount),
        date: new Date(parsed.date),
        note: parsed.note || null,
        method: parsed.method || "CASH",
      },
    });

    // Create a corresponding finance entry linked to this payment
    const client = await tx.client.findUnique({
      where: { id: parsed.clientId },
    });

    await tx.financeEntry.create({
      data: {
        date: new Date(parsed.date),
        type: "INCOME",
        description: `Оплата долга от ${client?.name || "клиента"}${parsed.note ? ` — ${parsed.note}` : ""}`,
        amount: new Prisma.Decimal(parsed.amount),
        relatedClientId: parsed.clientId,
        relatedPaymentId: payment.id,
        paymentMethod: parsed.method || "CASH",
        category: "DEBT_PAYMENT",
      },
    });

    return { payment, clientName: client?.name };
  });

  await logAction({
    action: "CREATE",
    entity: "Payment",
    entityId: result.payment.id,
    description: `Принята оплата ${parsed.amount} от ${result.clientName || "клиента"} (${parsed.method || "CASH"})`,
    snapshot: {
      id: result.payment.id,
      clientId: parsed.clientId,
      clientName: result.clientName,
      amount: parsed.amount,
      date: parsed.date,
      method: parsed.method || "CASH",
      note: parsed.note || null,
    },
  });

  revalidateAll();
  return result.payment;
}

export async function deletePayment(id: string) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!payment) {
    throw new Error("Оплата не найдена");
  }

  await prisma.$transaction(async (tx) => {
    // Delete linked finance entry
    await tx.financeEntry.deleteMany({
      where: {
        OR: [
          { relatedPaymentId: id },
          {
            relatedClientId: payment.clientId,
            amount: payment.amount,
            category: "DEBT_PAYMENT",
          },
        ],
      },
    });

    await tx.payment.delete({ where: { id } });
  });

  await logAction({
    action: "DELETE",
    entity: "Payment",
    entityId: id,
    description: `Удалена оплата ${payment.amount} от ${payment.client?.name || "клиента"}`,
    snapshot: {
      deletedRecord: {
        id: payment.id,
        clientId: payment.clientId,
        amount: Number(payment.amount),
        date: payment.date,
        method: payment.method,
        note: payment.note,
      },
    },
  });

  revalidateAll();
}
