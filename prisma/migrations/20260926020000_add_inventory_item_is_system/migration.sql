-- AlterTable: Add isSystem flag to InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;
