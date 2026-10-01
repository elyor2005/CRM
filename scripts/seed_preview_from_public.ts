import { PrismaClient } from "@prisma/client";

const previewPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_xXVo0zLEleH8@ep-restless-meadow-b4qxavuq.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=preview_test",
    },
  },
});

async function main() {
  console.log("Seeding preview_test schema from public data with explicit column mappings...");

  // 1. Client
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."Client" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."Client" ("id", "name", "phone", "address", "district", "visitFrequency", "createdAt")
    SELECT "id", "name", "phone", "address", "district", "visitFrequency", "createdAt"
    FROM "public"."Client";
  `);
  console.log("✓ Client copied");

  // 2. InventoryItem
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."InventoryItem" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."InventoryItem" ("id", "name", "category", "unit", "quantity", "costPrice", "salePrice", "minStock", "isSystem")
    SELECT "id", "name", "category"::text::"preview_test"."ItemCategory", "unit", "quantity", "costPrice", "salePrice", "minStock", "isSystem"
    FROM "public"."InventoryItem";
  `);
  console.log("✓ InventoryItem copied");

  // 3. RecipeLine
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."RecipeLine" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."RecipeLine" ("productId", "ingredientId", "qtyPerUnit")
    SELECT "productId", "ingredientId", "qtyPerUnit"
    FROM "public"."RecipeLine";
  `);
  console.log("✓ RecipeLine copied");

  // 4. Sale
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."Sale" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."Sale" ("id", "clientId", "date", "type", "payment", "createdAt")
    SELECT "id", "clientId", "date", "type"::text::"preview_test"."SaleType", "payment", "createdAt"
    FROM "public"."Sale";
  `);
  console.log("✓ Sale copied");

  // 5. SaleItem
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."SaleItem" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."SaleItem" ("id", "saleId", "productId", "quantity", "unitPrice", "lineTotal", "isFreebie", "freebieFor")
    SELECT "id", "saleId", "productId", "quantity", "unitPrice", "lineTotal", "isFreebie", "freebieFor"
    FROM "public"."SaleItem";
  `);
  console.log("✓ SaleItem copied");

  // 6. Payment
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."Payment" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."Payment" ("id", "clientId", "amount", "date", "method", "note")
    SELECT "id", "clientId", "amount", "date", "method"::text::"preview_test"."PaymentMethod", "note"
    FROM "public"."Payment";
  `);
  console.log("✓ Payment copied");

  // 7. FinanceEntry
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."FinanceEntry" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."FinanceEntry" ("id", "date", "type", "description", "amount", "relatedClientId", "relatedSaleId", "category", "paymentMethod")
    SELECT "id", "date", "type"::text::"preview_test"."FinanceType", "description", "amount", "relatedClientId", "relatedSaleId", "category", "paymentMethod"::text::"preview_test"."PaymentMethod"
    FROM "public"."FinanceEntry";
  `);
  console.log("✓ FinanceEntry copied");

  // 8. LiabilityEntry
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."LiabilityEntry" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."LiabilityEntry" ("id", "name", "amount", "date")
    SELECT "id", "name", "amount", "date"
    FROM "public"."LiabilityEntry";
  `);
  console.log("✓ LiabilityEntry copied");

  // 9. StockMovement
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."StockMovement" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."StockMovement" ("id", "itemId", "type", "quantity", "date", "note")
    SELECT "id", "itemId", "type"::text::"preview_test"."StockMovementType", "quantity", "date", "note"
    FROM "public"."StockMovement";
  `);
  console.log("✓ StockMovement copied");

  // 10. AuditLog
  await previewPrisma.$executeRawUnsafe(`TRUNCATE TABLE "preview_test"."AuditLog" CASCADE;`);
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."AuditLog" ("id", "action", "entity", "entityId", "description", "createdAt")
    SELECT "id", "action", "entity", "entityId", "description", "createdAt"
    FROM "public"."AuditLog";
  `);
  console.log("✓ AuditLog copied");

  // 11. Seed ExpenseCategory in preview_test
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."ExpenseCategory" ("id", "name", "createdAt")
    VALUES
      ('cat_raw_materials', 'Сырьё', CURRENT_TIMESTAMP),
      ('cat_packaging', 'Упаковка', CURRENT_TIMESTAMP),
      ('cat_salary', 'Зарплата', CURRENT_TIMESTAMP),
      ('cat_transportation', 'Транспорт', CURRENT_TIMESTAMP),
      ('cat_rent', 'Аренда', CURRENT_TIMESTAMP),
      ('cat_utilities', 'Коммунальные', CURRENT_TIMESTAMP),
      ('cat_marketing', 'Маркетинг', CURRENT_TIMESTAMP),
      ('cat_equipment', 'Оборудование', CURRENT_TIMESTAMP),
      ('cat_other', 'Прочее', CURRENT_TIMESTAMP)
    ON CONFLICT ("name") DO NOTHING;
  `);

  // Migrate distinct categories from FinanceEntry into ExpenseCategory in preview_test
  await previewPrisma.$executeRawUnsafe(`
    INSERT INTO "preview_test"."ExpenseCategory" ("id", "name", "createdAt")
    SELECT 'cat_' || md5(category), category, CURRENT_TIMESTAMP
    FROM (
        SELECT DISTINCT category
        FROM "preview_test"."FinanceEntry"
        WHERE category IS NOT NULL
          AND category != ''
          AND category != 'DEBT_PAYMENT'
    ) sub
    ON CONFLICT ("name") DO NOTHING;
  `);

  // Link existing FinanceEntry rows to ExpenseCategory in preview_test
  await previewPrisma.$executeRawUnsafe(`
    UPDATE "preview_test"."FinanceEntry" fe
    SET "expenseCategoryId" = ec."id"
    FROM "preview_test"."ExpenseCategory" ec
    WHERE fe."category" = ec."name"
      AND fe."expenseCategoryId" IS NULL;
  `);
  console.log("✓ ExpenseCategory seeded and FinanceEntry linked");

  console.log("All data successfully seeded into preview_test!");
}

main()
  .catch((e) => console.error("Error seeding preview:", e))
  .finally(() => previewPrisma.$disconnect());
