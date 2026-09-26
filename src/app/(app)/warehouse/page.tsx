"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, AlertTriangle, Download } from "lucide-react";
import { formatUZS, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import {
  getInventoryByCategory,
  createInventoryItem,
  getFinishedGoodsMovementBreakdown,
} from "@/app/actions/inventory";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { exportToExcel } from "@/lib/exportExcel";
import type { ItemCategory } from "@prisma/client";

type InventoryGroups = Awaited<ReturnType<typeof getInventoryByCategory>>;
type FGMovementItem = Awaited<ReturnType<typeof getFinishedGoodsMovementBreakdown>>[number];
type DatePreset = "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = formatDateInput(now);
  switch (preset) {
    case "TODAY":
      return { from: today, to: today };
    case "WEEK": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { from: formatDateInput(weekAgo), to: today };
    }
    case "MONTH": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatDateInput(monthStart), to: today };
    }
    default:
      return { from: today, to: today };
  }
}

export default function WarehousePage() {
  const { language, t } = useLanguage();
  const [groups, setGroups] = useState<InventoryGroups | null>(null);
  const [fgMovements, setFgMovements] = useState<FGMovementItem[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("TODAY");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showToast } = useToast();

  // Form state
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<ItemCategory>("FINISHED_GOOD");
  const [formUnit, setFormUnit] = useState("шт");
  const [formCostPrice, setFormCostPrice] = useState("");
  const [formSalePrice, setFormSalePrice] = useState("");
  const [formMinStock, setFormMinStock] = useState("");

  const categoryLabels: Record<string, string> = {
    FINISHED_GOOD: t("warehouse.finishedGoods"),
    RAW_MATERIAL: t("warehouse.rawMaterials"),
    PACKAGING: t("warehouse.packaging"),
  };

  const loadData = () => {
    startTransition(async () => {
      const range =
        datePreset === "CUSTOM"
          ? { from: customFrom || formatDateInput(new Date()), to: customTo || formatDateInput(new Date()) }
          : getDateRange(datePreset);

      const [data, fgData] = await Promise.all([
        getInventoryByCategory(),
        getFinishedGoodsMovementBreakdown({ dateFrom: range.from, dateTo: range.to }),
      ]);
      setGroups(data);
      setFgMovements(fgData);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [datePreset, customFrom, customTo]); // eslint-disable-line react-hooks/exhaustive-deps

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
          minStock: formMinStock || "",
        });
        showToast(t("common.add"));
        setSheetOpen(false);
        setFormName("");
        setFormCostPrice("");
        setFormSalePrice("");
        setFormMinStock("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  const handleExportExcel = () => {
    if (!groups) return;

    // Sheet 1: Finished Goods Movement Breakdown
    const fgHeaders = [
      t("common.name"),
      `${language === "ru" ? "Остаток на начало" : language === "uz" ? "Boshlang'ich qoldiq" : "Opening Balance"}`,
      `${language === "ru" ? "Приход (Производство)" : language === "uz" ? "Kirim (Ishlab chiqarish)" : "Production In"}`,
      `${language === "ru" ? "Возврат" : language === "uz" ? "Qaytarish" : "Return In"}`,
      `${language === "ru" ? "Брак" : language === "uz" ? "Nuqsonli" : "Defect"}`,
      `${language === "ru" ? "Бонус" : language === "uz" ? "Bonus" : "Bonus"}`,
      `${language === "ru" ? "Продажи" : language === "uz" ? "Sotuvlar" : "Sales Out"}`,
      `${language === "ru" ? "Остаток на конец" : language === "uz" ? "Yakuniy qoldiq" : "Closing Balance"}`,
      t("warehouse.costPrice"),
      t("warehouse.salePrice"),
      `${t("warehouse.totalValue")} (${t("common.sum")})`,
    ];

    const fgRows = fgMovements.map((item) => [
      item.name,
      item.openingBalance,
      item.productionIn,
      item.returnIn,
      item.defect,
      item.bonus,
      item.saleOut,
      item.closingBalance,
      item.costPrice,
      item.salePrice || 0,
      item.closingBalance * item.costPrice,
    ]);

    // Sheet 2: Raw Materials & Packaging
    const otherHeaders = [
      t("common.type"),
      t("common.name"),
      t("common.unit"),
      `${language === "ru" ? "Количество" : language === "uz" ? "Miqdori" : "Quantity"}`,
      t("warehouse.costPrice"),
      `${t("warehouse.totalValue")} (${t("common.sum")})`,
    ];

    const otherRows: (string | number)[][] = [];
    (groups.RAW_MATERIAL || []).forEach((item) => {
      otherRows.push([
        t("warehouse.rawMaterials"),
        item.name,
        item.unit,
        Number(item.quantity),
        Number(item.costPrice),
        Number(item.quantity) * Number(item.costPrice),
      ]);
    });
    (groups.PACKAGING || []).forEach((item) => {
      otherRows.push([
        t("warehouse.packaging"),
        item.name,
        item.unit,
        Number(item.quantity),
        Number(item.costPrice),
        Number(item.quantity) * Number(item.costPrice),
      ]);
    });

    exportToExcel(`Склад_${formatDateInput(new Date())}`, [
      { name: "Готовая продукция", data: [fgHeaders, ...fgRows] },
      { name: "Сырьё и Упаковка", data: [otherHeaders, ...otherRows] },
    ]);
  };

  const fgMap = new Map(fgMovements.map((fg) => [fg.id, fg]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("warehouse.title")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* 5a. Date/period selector */}
            <div className="w-full sm:w-auto">
              <SegmentedControl
                value={datePreset}
                onChange={(v) => setDatePreset(v as DatePreset)}
                options={[
                  { value: "TODAY", label: t("common.today") },
                  { value: "WEEK", label: t("common.thisWeek") },
                  { value: "MONTH", label: t("common.thisMonth") },
                  { value: "CUSTOM", label: t("common.custom") },
                ]}
              />
            </div>
            <Button variant="outline" size="md" onClick={handleExportExcel} disabled={loading || !groups}>
              <Download size={16} />
              <span className="hidden sm:inline">{t("common.exportExcel")}</span>
            </Button>
            <Button onClick={() => setSheetOpen(true)} size="md">
              <Plus size={18} /> {t("warehouse.newItem")}
            </Button>
          </div>
        }
      />

      {datePreset === "CUSTOM" && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <Input
            label={t("common.from")}
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <Input
            label={t("common.to")}
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
          />
        </div>
      )}

      {loading || !groups ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* 1. ГОТОВАЯ ПРОДУКЦИЯ (Task Group 5b breakdown) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                {categoryLabels.FINISHED_GOOD} ({groups.FINISHED_GOOD?.length || 0})
              </h3>
              {fgMovements.length > 0 && (
                <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 tabular-nums">
                  {t("warehouse.totalValue")}:{" "}
                  {formatUZS(
                    fgMovements.reduce(
                      (sum, item) => sum + item.closingBalance * item.costPrice,
                      0
                    )
                  )}{" "}
                  {t("common.sum")}
                </span>
              )}
            </div>

            {groups.FINISHED_GOOD?.length === 0 ? (
              <EmptyState icon={<Package size={24} />} title={t("common.noData")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {(groups.FINISHED_GOOD || []).map((item) => {
                  const fg = fgMap.get(item.id);
                  const closingBal = fg ? fg.closingBalance : Number(item.quantity);
                  const isLowStock = fg ? fg.isLowStock : Number(item.minStock) > 0 && closingBal <= Number(item.minStock);

                  return (
                    <Card
                      key={item.id}
                      hoverable
                      onClick={() => router.push(`/warehouse/${item.id}`)}
                      className="flex flex-col justify-between gap-3 p-4 bg-white dark:bg-[#131823] border border-gray-200/80 dark:border-zinc-800"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-extrabold text-base text-gray-900 dark:text-white leading-tight">
                          {item.name}
                        </div>
                        {isLowStock && (
                          <Badge variant="warning" className="shrink-0 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            <span>{t("dashboard.lowStock")}</span>
                          </Badge>
                        )}
                      </div>

                      {/* 5b. Movement Breakdown Details */}
                      {fg && (
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs py-2.5 px-3 bg-gray-50/80 dark:bg-zinc-800/40 rounded-xl border border-gray-100 dark:border-zinc-800/60">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-zinc-400">
                              {language === "ru" ? "Начало:" : language === "uz" ? "Boshlanish:" : "Opening:"}
                            </span>
                            <span className="font-bold text-gray-800 dark:text-zinc-200 tabular-nums">
                              {fg.openingBalance} {fg.unit}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              + {language === "ru" ? "Приход:" : language === "uz" ? "Kirim:" : "In:"}
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {fg.productionIn}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-teal-600 dark:text-teal-400 font-semibold">
                              + {language === "ru" ? "Возврат:" : language === "uz" ? "Qaytarish:" : "Return:"}
                            </span>
                            <span className="font-bold text-teal-600 dark:text-teal-400 tabular-nums">
                              {fg.returnIn}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              − {language === "ru" ? "Брак:" : language === "uz" ? "Brak:" : "Defect:"}
                            </span>
                            <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                              {fg.defect}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-orange-600 dark:text-orange-400 font-semibold">
                              − {language === "ru" ? "Бонус:" : language === "uz" ? "Bonus:" : "Bonus:"}
                            </span>
                            <span className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                              {fg.bonus}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-zinc-400">
                              − {language === "ru" ? "Продажи:" : language === "uz" ? "Sotuv:" : "Sales:"}
                            </span>
                            <span className="font-bold text-gray-700 dark:text-zinc-300 tabular-nums">
                              {fg.saleOut}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Footer: Closing balance & total value */}
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 pt-2.5 border-t border-gray-100 dark:border-zinc-800/80">
                        <div>
                          <span className="text-[11px] text-gray-400 block">
                            {language === "ru" ? "Остаток на конец" : language === "uz" ? "Yakuniy qoldiq" : "Closing Balance"}
                          </span>
                          <span className="font-extrabold text-gray-900 dark:text-white tabular-nums text-sm">
                            {closingBal} {item.unit}
                          </span>
                        </div>
                        {Number(item.costPrice) > 0 && (
                          <div className="text-right">
                            <span className="text-[11px] text-gray-400 block">
                              {t("warehouse.costPrice")}
                            </span>
                            <span className="font-semibold tabular-nums text-gray-700 dark:text-zinc-300">
                              {formatUZS(closingBal * Number(item.costPrice))} {t("common.sum")}
                            </span>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2. СЫРЬЁ (Raw Materials - Simple qty/value cards) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                {categoryLabels.RAW_MATERIAL} ({groups.RAW_MATERIAL?.length || 0})
              </h3>
              {(groups.RAW_MATERIAL || []).length > 0 && (
                <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 tabular-nums">
                  {t("warehouse.totalValue")}:{" "}
                  {formatUZS(
                    (groups.RAW_MATERIAL || []).reduce(
                      (sum, item) => sum + Number(item.quantity) * Number(item.costPrice),
                      0
                    )
                  )}{" "}
                  {t("common.sum")}
                </span>
              )}
            </div>

            {(groups.RAW_MATERIAL || []).length === 0 ? (
              <EmptyState icon={<Package size={24} />} title={t("common.noData")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {(groups.RAW_MATERIAL || []).map((item) => {
                  const isLowStock =
                    Number(item.minStock) > 0 && Number(item.quantity) <= Number(item.minStock);

                  return (
                    <Card
                      key={item.id}
                      hoverable
                      onClick={() => router.push(`/warehouse/${item.id}`)}
                      className="flex flex-col justify-between gap-3 p-4 bg-white dark:bg-[#131823] border border-gray-200/80 dark:border-zinc-800"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-extrabold text-base text-gray-900 dark:text-white leading-tight">
                          {item.name}
                        </div>
                        {isLowStock && (
                          <Badge variant="warning" className="shrink-0 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            <span>{t("dashboard.lowStock")}</span>
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 pt-3 border-t border-gray-100 dark:border-zinc-800/80">
                        <span className="font-extrabold text-gray-900 dark:text-white tabular-nums text-sm">
                          {Number(item.quantity)} {item.unit}
                        </span>
                        {Number(item.costPrice) > 0 && (
                          <span className="font-semibold tabular-nums">
                            {formatUZS(Number(item.quantity) * Number(item.costPrice))}{" "}
                            {t("common.sum")}
                          </span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* 3. УПАКОВКА (Packaging - Simple qty/value cards) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                {categoryLabels.PACKAGING} ({groups.PACKAGING?.length || 0})
              </h3>
              {(groups.PACKAGING || []).length > 0 && (
                <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 tabular-nums">
                  {t("warehouse.totalValue")}:{" "}
                  {formatUZS(
                    (groups.PACKAGING || []).reduce(
                      (sum, item) => sum + Number(item.quantity) * Number(item.costPrice),
                      0
                    )
                  )}{" "}
                  {t("common.sum")}
                </span>
              )}
            </div>

            {(groups.PACKAGING || []).length === 0 ? (
              <EmptyState icon={<Package size={24} />} title={t("common.noData")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {(groups.PACKAGING || []).map((item) => {
                  const isLowStock =
                    Number(item.minStock) > 0 && Number(item.quantity) <= Number(item.minStock);

                  return (
                    <Card
                      key={item.id}
                      hoverable
                      onClick={() => router.push(`/warehouse/${item.id}`)}
                      className="flex flex-col justify-between gap-3 p-4 bg-white dark:bg-[#131823] border border-gray-200/80 dark:border-zinc-800"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-extrabold text-base text-gray-900 dark:text-white leading-tight">
                          {item.name}
                        </div>
                        {isLowStock && (
                          <Badge variant="warning" className="shrink-0 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            <span>{t("dashboard.lowStock")}</span>
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 pt-3 border-t border-gray-100 dark:border-zinc-800/80">
                        <span className="font-extrabold text-gray-900 dark:text-white tabular-nums text-sm">
                          {Number(item.quantity)} {item.unit}
                        </span>
                        {Number(item.costPrice) > 0 && (
                          <span className="font-semibold tabular-nums">
                            {formatUZS(Number(item.quantity) * Number(item.costPrice))}{" "}
                            {t("common.sum")}
                          </span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={() => setSheetOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 pl-0.5">
              {t("common.type")}
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-[#1E2638] text-gray-900 dark:text-white rounded-xl text-base border border-gray-200/60 dark:border-zinc-800 outline-none transition-all focus:ring-2 focus:ring-indigo-500/80 min-h-[44px]"
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

          <Input
            label={t("warehouse.minStock")}
            type="number"
            step="any"
            min="0"
            placeholder="0"
            value={formMinStock}
            onChange={(e) => setFormMinStock(e.target.value)}
          />

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
    </div>
  );
}
