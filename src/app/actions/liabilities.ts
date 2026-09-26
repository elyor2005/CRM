"use server";

import { prisma } from "@/lib/db";

export async function getLiabilities() {
  return prisma.liabilityEntry.findMany({
    orderBy: { date: "desc" },
  });
}

export async function getLiabilitiesTotal() {
  const result = await prisma.liabilityEntry.aggregate({
    _sum: { amount: true },
  });
  return Number(result._sum.amount || 0);
}
