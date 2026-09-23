import { z } from "zod";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const decimalString = z
  .string()
  .or(z.number())
  .transform((v) => String(v))
  .refine((v) => !isNaN(Number(v)), "Введите число");

const positiveDecimal = decimalString.refine(
  (v) => Number(v) > 0,
  "Значение должно быть больше 0"
);

const nonNegativeDecimal = decimalString.refine(
  (v) => Number(v) >= 0,
  "Значение не может быть отрицательным"
);

// ─── Client ──────────────────────────────────────────────────────────────────

export const ClientSchema = z.object({
  name: z.string().min(1, "Введите имя клиента").max(200),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

export type ClientInput = z.infer<typeof ClientSchema>;

// ─── Sale ────────────────────────────────────────────────────────────────────

export const SaleItemSchema = z.object({
  productId: z.string().min(1, "Выберите товар"),
  quantity: positiveDecimal,
  unitPrice: nonNegativeDecimal,
  isFreebie: z.boolean().default(false),
  freebieFor: z.string().max(200).optional().or(z.literal("")),
});

export const SaleFormSchema = z.object({
  clientId: z.string().min(1, "Выберите клиента"),
  type: z.enum(["SALE", "RETURN"]),
  date: z.string().min(1, "Укажите дату"),
  payment: nonNegativeDecimal,
  items: z.array(SaleItemSchema).min(1, "Добавьте хотя бы один товар"),
});

export type SaleFormInput = z.infer<typeof SaleFormSchema>;

// ─── Payment ─────────────────────────────────────────────────────────────────

export const PaymentFormSchema = z.object({
  clientId: z.string().min(1, "Выберите клиента"),
  amount: positiveDecimal,
  date: z.string().min(1, "Укажите дату"),
  note: z.string().max(500).optional().or(z.literal("")),
});

export type PaymentFormInput = z.infer<typeof PaymentFormSchema>;

// ─── Finance Entry ───────────────────────────────────────────────────────────

export const FinanceEntryFormSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().min(1, "Введите описание").max(500),
  amount: positiveDecimal,
  date: z.string().min(1, "Укажите дату"),
});

export type FinanceEntryFormInput = z.infer<typeof FinanceEntryFormSchema>;

// ─── Inventory / Warehouse ───────────────────────────────────────────────────

export const ProductionSchema = z.object({
  itemId: z.string().min(1),
  quantity: positiveDecimal,
});

export type ProductionInput = z.infer<typeof ProductionSchema>;

export const RestockSchema = z.object({
  itemId: z.string().min(1),
  quantity: positiveDecimal,
});

export type RestockInput = z.infer<typeof RestockSchema>;

export const WriteOffSchema = z.object({
  itemId: z.string().min(1),
  quantity: positiveDecimal,
  reason: z.enum(["DEFECT", "ADJUSTMENT"]),
  note: z.string().max(500).optional().or(z.literal("")),
});

export type WriteOffInput = z.infer<typeof WriteOffSchema>;

export const RecipeLineSchema = z.object({
  ingredientId: z.string().min(1, "Выберите ингредиент"),
  qtyPerUnit: positiveDecimal,
});

export const RecipeSchema = z.object({
  productId: z.string().min(1),
  lines: z.array(RecipeLineSchema),
});

export type RecipeInput = z.infer<typeof RecipeSchema>;

// ─── Inventory Item ──────────────────────────────────────────────────────────

export const InventoryItemSchema = z.object({
  name: z.string().min(1, "Введите название").max(200),
  category: z.enum(["FINISHED_GOOD", "RAW_MATERIAL", "PACKAGING"]),
  unit: z.string().min(1, "Введите единицу измерения").max(20),
  costPrice: nonNegativeDecimal,
  salePrice: nonNegativeDecimal.optional().or(z.literal("")),
});

export type InventoryItemInput = z.infer<typeof InventoryItemSchema>;

// ─── Liability ───────────────────────────────────────────────────────────────

export const LiabilityEntrySchema = z.object({
  name: z.string().min(1, "Введите название").max(200),
  amount: positiveDecimal,
  date: z.string().min(1, "Укажите дату"),
});

export type LiabilityEntryInput = z.infer<typeof LiabilityEntrySchema>;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  pin: z.string().min(1, "Введите PIN-код"),
});
