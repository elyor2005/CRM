"use client";

import { useState, useEffect, useTransition } from "react";
import { Settings, Save } from "lucide-react";
import { formatUZS } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { getAllItems, updateInventoryItem } from "@/app/actions/inventory";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EXPENSE_CATEGORIES } from "@/lib/validations";

type InventoryItem = Awaited<ReturnType<typeof getAllItems>>[number];

export default function SettingsPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { showToast } = useToast();

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("");

  const loadData = () => {
    startTransition(async () => {
      const data = await getAllItems();
      setItems(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startEditing = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditUnit(item.unit);
    setEditCostPrice(String(Number(item.costPrice)));
    setEditSalePrice(item.salePrice ? String(Number(item.salePrice)) : "");
    setEditMinStock(String(Number(item.minStock)));
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSave = (item: InventoryItem) => {
    if (!editName.trim()) return;
    startTransition(async () => {
      try {
        await updateInventoryItem(item.id, {
          name: editName.trim(),
          category: item.category,
          unit: editUnit || "шт",
          costPrice: editCostPrice || "0",
          salePrice: editSalePrice || "",
          minStock: editMinStock || "",
        });
        showToast(t("common.save"));
        setEditingId(null);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  const categoryLabels: Record<string, string> = {
    FINISHED_GOOD: t("warehouse.finishedGoods"),
    RAW_MATERIAL: t("warehouse.rawMaterials"),
    PACKAGING: t("warehouse.packaging"),
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t("settings.title")} />

      {/* Products & Materials (Task 9a) */}
      <section className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
          {t("settings.productsAndMaterials")}
        </h3>

        {loading ? (
          <CardSkeleton />
        ) : items.length === 0 ? (
          <EmptyState icon={<Settings size={28} />} title={t("common.noData")} />
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/70 dark:bg-[#182030]/60 text-xs uppercase font-bold text-gray-500 dark:text-zinc-400 tracking-wider">
                    <th className="px-4 py-3">{t("common.name")}</th>
                    <th className="px-4 py-3">{t("common.category")}</th>
                    <th className="px-4 py-3">{t("common.unit")}</th>
                    <th className="px-4 py-3 text-right">{t("warehouse.costPrice")}</th>
                    <th className="px-4 py-3 text-right">{t("warehouse.salePrice")}</th>
                    <th className="px-4 py-3 text-right">{t("warehouse.minStock")}</th>
                    <th className="px-4 py-3 text-center">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                  {items.filter(i => i.name !== "__OPENING_BALANCE__").map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      {editingId === item.id ? (
                        <>
                          <td className="px-3 py-2">
                            <input
                              className="w-full px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-zinc-400 text-xs font-semibold">
                            {categoryLabels[item.category] || item.category}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="w-20 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white"
                              value={editUnit}
                              onChange={(e) => setEditUnit(e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              className="w-28 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white text-right"
                              value={editCostPrice}
                              onChange={(e) => setEditCostPrice(e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              className="w-28 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white text-right"
                              value={editSalePrice}
                              onChange={(e) => setEditSalePrice(e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              className="w-24 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white text-right"
                              value={editMinStock}
                              onChange={(e) => setEditMinStock(e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSave(item)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300 text-xs font-bold hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{item.name}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 text-xs font-semibold">
                            {categoryLabels[item.category] || item.category}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">{item.unit}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">{formatUZS(item.costPrice)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                            {item.salePrice ? formatUZS(item.salePrice) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">{Number(item.minStock)}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => startEditing(item)}
                              className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-xs font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                              {t("common.edit")}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* Expense Categories (Task 9b — read-only) */}
      <section className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
          {t("settings.expenseCategories")}
        </h3>
        <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800/80 p-0 overflow-hidden">
          {EXPENSE_CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center justify-between p-3.5 text-sm">
              <span className="text-gray-900 dark:text-white font-semibold">
                {t(`expenseCategories.${cat}`, cat)}
              </span>
              <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{cat}</span>
            </div>
          ))}
        </Card>
        <p className="text-xs text-gray-400 dark:text-zinc-500 px-1">
          Категории расходов в настоящий момент доступны только для просмотра.
        </p>
      </section>
    </div>
  );
}
