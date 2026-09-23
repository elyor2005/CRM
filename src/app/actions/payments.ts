"use server";

import { prisma } from "@/lib/db";
import { PaymentFormSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export async function createPayment(data: unknown) {
  const parsed = PaymentFormSchema.parse(data);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create the payment
    await tx.payment.create({
      data: {
        clientId: parsed.clientId,
        amount: new Prisma.Decimal(parsed.amount),
        date: new Date(parsed.date),
        note: parsed.note || null,
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
      },
    });
  });

  revalidatePath("/debts");
  revalidatePath("/finance");
  revalidatePath("/report");
}
