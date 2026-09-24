"use server";

import { prisma } from "@/lib/db";
import { PaymentFormSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
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

    // Create a corresponding finance entry
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
  });

  try {
    revalidatePath("/debts");
    revalidatePath("/finance");
    revalidatePath("/report");
  } catch {}
}
