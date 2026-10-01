import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  let url = process.env.DATABASE_URL || "";
  // Strip psql wrapper if user pasted it directly
  if (url.startsWith("psql ")) {
    url = url.replace(/^psql\s+['"]?/, "").replace(/['"]?$/, "");
  }

  const schemaMatch = url.match(/[?&]schema=([^&]+)/);
  const schema = schemaMatch ? schemaMatch[1] : undefined;

  try {
    if (schema && schema !== "public") {
      return new PrismaClient({
        datasources: { db: { url } },
      });
    }
    const adapter = new PrismaNeon({ connectionString: url });
    return new PrismaClient({ adapter });
  } catch (e) {
    console.warn("Failed to initialize PrismaNeon adapter, falling back to standard PrismaClient:", e);
    return new PrismaClient({
      datasources: {
        db: { url },
      },
    });
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
