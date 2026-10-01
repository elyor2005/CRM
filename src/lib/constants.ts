/**
 * Shared application constants.
 */

export const OPENING_BALANCE_ITEM_NAME = "__OPENING_BALANCE__";

/**
 * Prisma filter to exclude system items and opening balance placeholder records
 * from product listings, inventory views, and reports.
 */
export const REAL_ITEMS_FILTER = {
  isSystem: false,
  NOT: { name: OPENING_BALANCE_ITEM_NAME },
} as const;

/**
 * In-memory predicate to filter out system items and opening balance records.
 */
export function isRealItem(item: { name: string; isSystem?: boolean }): boolean {
  return !item.isSystem && item.name !== OPENING_BALANCE_ITEM_NAME;
}
