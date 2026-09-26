-- AlterTable: Add district and visitFrequency to Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "visitFrequency" INTEGER;
