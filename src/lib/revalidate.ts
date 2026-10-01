import { revalidatePath } from "next/cache";

/**
 * Robust revalidation helper to prevent data going stale across pages.
 * Dashboard aggregates sales, payments, finance, warehouse stock, clients, and liabilities,
 * so whenever any entity mutates, /dashboard and / MUST be revalidated along with the module pages.
 */
export function revalidateRoute(primaryPath: string, extraPaths: string[] = []) {
  const paths = new Set([
    primaryPath,
    "/dashboard",
    "/",
    "/audit",
    ...extraPaths,
  ]);

  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {}
  }
}

export function revalidateAll() {
  const allPaths = [
    "/dashboard",
    "/",
    "/sales",
    "/debts",
    "/finance",
    "/warehouse",
    "/report",
    "/audit",
    "/settings",
  ];

  for (const p of allPaths) {
    try {
      revalidatePath(p);
    } catch {}
  }
}
