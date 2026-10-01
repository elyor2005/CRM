-- =============================================================================
-- Migration V2 (feature/fixes-and-v2-2026-09)
-- Reviewed SQL for Production / Neon Postgres
-- NOTE: Do NOT run `prisma migrate deploy` (as _prisma_migrations does not exist).
-- This script is completely non-destructive and idempotent.
-- =============================================================================

-- 1. Create AssetEntry table (mirror of LiabilityEntry for Debit side of Balance Report)
CREATE TABLE IF NOT EXISTS "AssetEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetEntry_pkey" PRIMARY KEY ("id")
);

-- 2. Create ExpenseCategory table
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- 3. Add columns to FinanceEntry for Category relation and Payment linkage
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "expenseCategoryId" TEXT;
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "relatedPaymentId" TEXT;

-- Foreign key constraints (safe add)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FinanceEntry_expenseCategoryId_fkey'
    ) THEN
        ALTER TABLE "FinanceEntry"
        ADD CONSTRAINT "FinanceEntry_expenseCategoryId_fkey"
        FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FinanceEntry_relatedPaymentId_fkey'
    ) THEN
        ALTER TABLE "FinanceEntry"
        ADD CONSTRAINT "FinanceEntry_relatedPaymentId_fkey"
        FOREIGN KEY ("relatedPaymentId") REFERENCES "Payment"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Add snapshot column to AuditLog for Undo functionality
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "snapshot" JSONB;

-- 5. Seed default expense categories into ExpenseCategory table
INSERT INTO "ExpenseCategory" ("id", "name", "createdAt")
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

-- 6. Migrate any historical distinct categories from FinanceEntry into ExpenseCategory
INSERT INTO "ExpenseCategory" ("id", "name", "createdAt")
SELECT 'cat_' || md5(category), category, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT category
    FROM "FinanceEntry"
    WHERE category IS NOT NULL
      AND category != ''
      AND category != 'DEBT_PAYMENT'
) sub
ON CONFLICT ("name") DO NOTHING;

-- 7. Link existing FinanceEntry rows to their ExpenseCategory
UPDATE "FinanceEntry" fe
SET "expenseCategoryId" = ec."id"
FROM "ExpenseCategory" ec
WHERE fe."category" = ec."name"
  AND fe."expenseCategoryId" IS NULL;

-- =============================================================================
-- Migration V2 verified and ready for review.
-- =============================================================================
