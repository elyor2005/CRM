"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { formatUZS } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/components/ui/Toast";
import { getInventoryByCategory, createInventoryItem } from "@/app/actions/inventory";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ItemCategory } from "@prisma/client";

type InventoryGroups = Awaited<ReturnType<typeof getInventoryByCategory>>;

const categoryOrder: string[] = ["FINISHED_GOOD", "RAW_MATERIAL", "PACKAGING"];

export default function WarehousePage() {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<InventoryGroups | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  // Form state
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<ItemCategory>("FINISHED_GOOD");
  const [formUnit, setFormUnit] = useState("шт");
  const [formCostPrice, setFormCostPrice] = useState("");
  const [formSalePrice, setFormSalePrice] = useState("");

  const categoryLabels: Record<string, string> = {
    FINISHED_GOOD: t("warehouse.finishedGoods"),
    RAW_MATERIAL: t("warehouse.rawMaterials"),
    PACKAGING: t("warehouse.packaging"),
  };

  const loadData = () => {
    startTransition(async () => {
      const data = await getInventoryByCategory();
      setGroups(data);
    });
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = () => {
    if (!formName.trim()) return;
    startTransition(async () => {
      try {
        await createInventoryItem({
          name: formName.trim(),
          category: formCategory,
          unit: formUnit || "шт",
          costPrice: formCostPrice || "0",
          salePrice: formSalePrice || "",
        });
        showToast(t("common.add"));
        setSheetOpen(false);
        setFormName("");
        setFormCostPrice("");
        setFormSalePrice("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  return (
    <>
      <PageHeader
        title={t("warehouse.title")}
        action={
          <Button onClick={() => setSheetOpen(true)} size="md">
            <Plus size={18} /> {t("warehouse.newItem")}
          </Button>
        }
      />

      {!groups ? (
        <div className="py-12 text-center text-gray-500 font-medium">{t("common.loading")}</div>
      ) : (
        <div className="flex flex-col gap-8">
          {categoryOrder.map((cat) => {
            const items = groups[cat] || [];
            const totalValue = items.reduce(
              (sum, item) => sum + Number(item.quantity) * Number(item.costPrice),
              0
            );

            return (
              <div key={cat} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                    {categoryLabels[cat]}
                  </h3>
                  {totalValue > 0 && (
                    <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                      {t("warehouse.totalValue")}: {formatUZS(totalValue)} {t("common.sum")}
                    </span>
                  )}
                </div>

                {items.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-gray-400">{t("common.noData")}</Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((item) => (
                      <Card
                        key={item.id}
                        hoverable
                        onClick={() => router.push(`/warehouse/${item.id}`)}
                        className="flex flex-col justify-between gap-2"
                      >
                        <div className="font-bold text-base text-gray-900 dark:text-white">
                          {item.name}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 pt-2 border-t border-gray-100 dark:border-zinc-800">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {Number(item.quantity)} {item.unit}
                          </span>
                          {Number(item.costPrice) > 0 && (
                            <span>
                              {formatUZS(Number(item.quantity) * Number(item.costPrice))}{" "}
                              {t("common.sum")}
                            </span>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={() => setSheetOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        <Plus size={26} />
      </button>

      {/* Add Item Modal Sheet */}
      <ModalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t("warehouse.newItem")}>
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.name")}
            placeholder={`${t("common.name")}...`}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            autoFocus
          />

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 pl-1">
              {t("common.type")}
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl outline-none text-base border border-transparent focus:ring-2 focus:ring-blue-500/20"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as ItemCategory)}
            >
              <option value="FINISHED_GOOD">{t("warehouse.finishedGoods")}</option>
              <option value="RAW_MATERIAL">{t("warehouse.rawMaterials")}</option>
              <option value="PACKAGING">{t("warehouse.packaging")}</option>
            </select>
          </div>

          <Input
            label={t("common.unit")}
            placeholder="pcs, kg, L..."
            value={formUnit}
            onChange={(e) => setFormUnit(e.target.value)}
          />

          <Input
            label={t("warehouse.costPrice")}
            type="number"
            step="any"
            min="0"
            placeholder="0"
            value={formCostPrice}
            onChange={(e) => setFormCostPrice(e.target.value)}
          />

          {formCategory === "FINISHED_GOOD" && (
            <Input
              label={t("warehouse.salePrice")}
              type="number"
              step="any"
              min="0"
              placeholder="0"
              value={formSalePrice}
              onChange={(e) => setFormSalePrice(e.target.value)}
            />
          )}

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={!formName.trim()}
            loading={isPending}
          >
            {t("common.add")}
          </Button>
        </div>
      </ModalSheet>
    </>
  );
}
