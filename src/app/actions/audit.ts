"use server";

import { prisma } from "@/lib/db";

export async function logAction(data: {
  action: string;
  entity: string;
  entityId?: string;
  description: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        description: data.description,
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
