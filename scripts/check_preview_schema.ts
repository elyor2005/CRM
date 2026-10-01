import { PrismaClient } from "@prisma/client";

const previewUrl =
  "postgresql://neondb_owner:npg_xXVo0zLEleH8@ep-restless-meadow-b4qxavuq.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=preview_test";

const prisma = new PrismaClient({
  datasources: { db: { url: previewUrl } },
});

async function main() {
  const schemas: any[] = await prisma.$queryRawUnsafe(`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    ORDER BY schema_name;
  `);
  console.log("ALL_SCHEMAS:", schemas.map((s) => s.schema_name));

  const tables: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'preview_test';
  `);
  console.log("Tables in preview_test:", tables.map((t) => t.table_name));

  const auditCols: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'preview_test' AND table_name = 'AuditLog';
  `);
  console.log("AuditLog columns in preview_test:", auditCols.map((c) => c.column_name));

  const financeCols: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'preview_test' AND table_name = 'FinanceEntry';
  `);
  console.log("FinanceEntry columns in preview_test:", financeCols.map((c) => c.column_name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
