"use server";

import { prisma } from "@/lib/db";
import { REAL_ITEMS_FILTER } from "@/lib/constants";

export interface SearchResults {
  clients: Array<{
    id: string;
    name: string;
    phone: string | null;
    district: string | null;
  }>;
  products: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    salePrice: number | null;
    category: string;
  }>;
  sales: Array<{
    id: string;
    date: string;
    type: string;
    client: { id: string; name: string };
    itemSummary: string;
    totalAmount: number;
  }>;
}

export async function searchGlobal(rawQuery: string): Promise<SearchResults> {
  const query = (rawQuery || "").trim();
  if (!query || query.length < 2) {
    return { clients: [], products: [], sales: [] };
  }

  const [clients, products, sales] = await Promise.all([
    // 1. Search clients by name, phone, or district
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          { district: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        district: true,
      },
      take: 5,
      orderBy: { name: "asc" },
    }),

    // 2. Search products by name
    prisma.inventoryItem.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
        ...REAL_ITEMS_FILTER,
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        unit: true,
        salePrice: true,
        category: true,
      },
      take: 5,
      orderBy: { name: "asc" },
    }),

    // 3. Search sales by client name
    prisma.sale.findMany({
      where: {
        client: {
          name: { contains: query, mode: "insensitive" },
        },
      },
      include: {
        client: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      take: 5,
      orderBy: { date: "desc" },
    }),
  ]);

  return {
    clients,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      quantity: Number(p.quantity),
      unit: p.unit,
      salePrice: p.salePrice ? Number(p.salePrice) : null,
      category: p.category,
    })),
    sales: sales.map((s) => {
      const totalAmount = s.items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
      const itemSummary = s.items.map((i) => i.product.name).join(", ");
      return {
        id: s.id,
        date: s.date.toISOString().split("T")[0],
        type: s.type,
        client: s.client,
        itemSummary,
        totalAmount,
      };
    }),
  };
}
