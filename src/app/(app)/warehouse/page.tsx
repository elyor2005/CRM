"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, AlertTriangle, Download, AlertOctagon, Gift, Layers, ArrowDownRight } from "lucide-react";
import { formatUZS, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/components/ui/Toast";
import { DateRangePicker, getDateRange, type DatePresetKey } from "@/components/ui/DateRangePicker";
import {
  getInventoryByCategory,
  createInventoryItem,
  getFinishedGoodsMovementBreakdown,
  produceItem,
  restockItem,
  writeOffItem,
  createBonusItem,
} from "@/app/actions/inventory";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Table, TableRow } from "@/components/ui/Table";
import { exportToExcel } from "@/lib/exportExcel";
import type { ItemCategory } from "@prisma/client";

type InventoryGroups = Awaited<ReturnType<typeof getInventoryByCategory>>;
type FGMovementItem = Awaited<ReturnType<typeof getFinishedGoodsMovementBreakdown>>[number];

export default function WarehousePage() {
  const { language, t } = useLanguage();
  const [groups, setGroups] = useState<InventoryGroups | null>(null);
  const [fgMovements, setFgMovements] = useState<FGMovementItem[]>([]);
  const [datePreset, setDatePreset] = useState<string>("TODAY");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showToast } = useToast();

  // Quick action state (Defect, Bonus, Restock, Produce directly from card)
  const [actionItem, setActionItem] = useState<{
    type: "PRODUCTION" | "RESTOCK" | "DEFECT" | "BONUS";
    id: string;
    name: string;
    unit: string;
  } | null>(null);
  const [actionQty, setActionQty] = useState("");
  const [actionDate, setActionDate] = useState(() => formatDateInput(new Date()));
  const [actionNote, setActionNote] = useState("");
  const [actionRecipient, setActionRecipient] = useState("");

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
      const range = getDateRange(datePreset, customFrom, customTo);

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

  const handleActionSubmit = () => {
    if (!actionItem || !actionQty || Number(actionQty) <= 0) return;
    startTransition(async () => {
      try {
        if (actionItem.type === "PRODUCTION") {
          await produceItem({ itemId: actionItem.id, quantity: actionQty, date: actionDate });
          showToast(`Произведено: ${actionQty} ${actionItem.unit}`);
        } else if (actionItem.type === "RESTOCK") {
          await restockItem({ itemId: actionItem.id, quantity: actionQty, date: actionDate });
          showToast(`Приход: ${actionQty} ${actionItem.unit}`);
        } else if (actionItem.type === "DEFECT") {
          await writeOffItem({
            itemId: actionItem.id,
            quantity: actionQty,
            reason: "DEFECT",
            note: actionNote || "Брак",
            date: actionDate,
          });
          showToast(`Брак списан: ${actionQty} ${actionItem.unit}`);
        } else if (actionItem.type === "BONUS") {
          await createBonusItem({
            itemId: actionItem.id,
            quantity: actionQty,
            recipient: actionRecipient,
            note: actionNote,
            date: actionDate,
          });
          showToast(`Бонус/образец выдан: ${actionQty} ${actionItem.unit}`);
        }
        setActionItem(null);
        setActionQty("");
        setActionNote("");
        setActionRecipient("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const handleExportExcel = () => {
    if (!groups) return;

    // Sheet 1: Finished Goods Movement Breakdown (10 columns matching table order)
    const fgHeaders = [
      language === "ru" ? "Название" : language === "uz" ? "Nomi" : "Name",
      language === "ru" ? "Остаток на начало" : language === "uz" ? "Boshlang'ich qoldiq" : "Opening Balance",
      language === "ru" ? "Производство (+)" : language === "uz" ? "Ishlab chiqarish (+)" : "Production (+)",
      language === "ru" ? "Возврат (+)" : language === "uz" ? "Qaytarish (+)" : "Return (+)",
      language === "ru" ? "Продажа (−)" : language === "uz" ? "Sotuv (−)" : "Sales (−)",
      language === "ru" ? "Бонус/Образец (−)" : language === "uz" ? "Bonus/Namuna (−)" : "Bonus/Sample (−)",
      language === "ru" ? "Брак (−)" : language === "uz" ? "Brak (−)" : "Defect (−)",
      language === "ru" ? "Остаток на конец дня" : language === "uz" ? "Yakuniy qoldiq" : "Closing Balance",
      language === "ru" ? "Себестоимость" : language === "uz" ? "Tannarx summasi" : "Cost Value",
      language === "ru" ? "Сумма по цене продажи" : language === "uz" ? "Sotuv narxida summa" : "Sale Value",
    ];

    const fgRows = fgMovements.map((item) => [
      item.name,
      item.openingBalance,
      item.productionIn,
      item.returnIn,
      item.saleOut,
      item.bonus,
      item.defect,
      item.closingBalance,
      item.closingBalance * item.costPrice,
      item.closingBalance * (item.salePrice || 0),
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
            {/* Shared Date/period selector */}
            <DateRangePicker
              value={datePreset}
              onChange={setDatePreset}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
            />
            <Button
              variant="outline"
              size="md"
              onClick={handleExportExcel}
              disabled={loading || !groups}
              className="min-h-[44px] gap-2 px-3.5 bg-white dark:bg-[#131823] border-gray-200/80 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 shadow-xs"
            >
              <Download size={16} className="text-gray-500 dark:text-zinc-400" />
              <span className="text-xs sm:text-sm font-bold">{t("common.exportExcel")}</span>
            </Button>
            <Button onClick={() => setSheetOpen(true)} size="md" className="min-h-[44px] gap-2 px-4 shadow-xs">
              <Plus size={18} /> <span className="text-xs sm:text-sm font-bold">{t("warehouse.newItem")}</span>
            </Button>
          </div>
        }
      />

      {loading || !groups ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* 1. ГОТОВАЯ ПРОДУКЦИЯ (Table view matching handwritten stock log) */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                {categoryLabels.FINISHED_GOOD} ({groups.FINISHED_GOOD?.length || 0})
              </h3>
              {fgMovements.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500 dark:text-zinc-400 tabular-nums">
                  <span>
                    Себестоимость:{" "}
                    {formatUZS(
                      fgMovements.reduce(
                        (sum, item) => sum + item.closingBalance * item.costPrice,
                        0
                      )
                    )}{" "}
                    {t("common.sum")}
                  </span>
                  <span>•</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    По цене продажи:{" "}
                    {formatUZS(
                      fgMovements.reduce(
                        (sum, item) => sum + item.closingBalance * (item.salePrice || 0),
                        0
                      )
                    )}{" "}
                    {t("common.sum")}
                  </span>
                </div>
              )}
            </div>

            {groups.FINISHED_GOOD?.length === 0 ? (
              <EmptyState icon={<Package size={24} />} title={t("common.noData")} />
            ) : (
              <Table
                minWidth="min-w-[950px]"
                alignments={[
                  "left",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                ]}
                headers={[
                  language === "ru" ? "Название" : language === "uz" ? "Nomi" : "Name",
                  language === "ru" ? "Остаток на начало" : language === "uz" ? "Boshlang'ich qoldiq" : "Opening Balance",
                  <span key="prod" className="text-emerald-600 dark:text-emerald-400">
                    {language === "ru" ? "Производство (+)" : language === "uz" ? "Ishlab chiqarish (+)" : "Production (+)"}
                  </span>,
                  <span key="ret" className="text-emerald-600 dark:text-emerald-400">
                    {language === "ru" ? "Возврат (+)" : language === "uz" ? "Qaytarish (+)" : "Return (+)"}
                  </span>,
                  <span key="sale" className="text-rose-600 dark:text-rose-400">
                    {language === "ru" ? "Продажа (−)" : language === "uz" ? "Sotuv (−)" : "Sales (−)"}
                  </span>,
                  <span key="bonus" className="text-rose-600 dark:text-rose-400">
                    {language === "ru" ? "Бонус/Образец (−)" : language === "uz" ? "Bonus/Namuna (−)" : "Bonus/Sample (−)"}
                  </span>,
                  <span key="defect" className="text-rose-600 dark:text-rose-400">
                    {language === "ru" ? "Брак (−)" : language === "uz" ? "Brak (−)" : "Defect (−)"}
                  </span>,
                  language === "ru" ? "Остаток на конец дня" : language === "uz" ? "Yakuniy qoldiq" : "Closing Balance",
                  language === "ru" ? "Себестоимость" : language === "uz" ? "Tannarx summasi" : "Cost Value",
                  language === "ru" ? "Сумма по цене продажи" : language === "uz" ? "Sotuv narxida summa" : "Sale Value",
                ]}
              >
                {(groups.FINISHED_GOOD || []).map((item) => {
                  const fg = fgMap.get(item.id);
                  const closingBal = fg ? fg.closingBalance : Number(item.quantity);
                  const isLowStock = fg ? fg.isLowStock : Number(item.minStock) > 0 && closingBal <= Number(item.minStock);

                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => router.push(`/warehouse/${item.id}`)}
                      className="cursor-pointer group"
                    >
                      {/* 1. Название */}
                      <td className="px-4 sm:px-5 py-3.5 text-left font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {item.name}
                          </span>
                          {isLowStock && (
                            <Badge variant="warning" className="text-[10px] px-1.5 py-0.5 shrink-0 flex items-center gap-1 font-semibold">
                              <AlertTriangle size={10} />
                              <span>{t("dashboard.lowStock")}</span>
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* 2. Остаток на начало */}
                      <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                        {fg ? fg.openingBalance : 0}
                      </td>

                      {/* 3. Производство (+) — green */}
                      <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {fg ? fg.productionIn : 0}
                      </td>

                      {/* 4. Возврат (+) — green */}
                      <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {fg ? fg.returnIn : 0}
                      </td>

                      {/* 5. Продажа (−) — red */}
                      <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                        {fg ? fg.saleOut : 0}
                      </td>

                      {/* 6. Бонус/Образец (−) — red */}
                      <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                        {fg ? fg.bonus : 0}
                      </td>

                      {/* 7. Брак (−) — red */}
                      <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                        {fg ? fg.defect : 0}
                      </td>

                      {/* 8. Остаток на конец дня */}
                      <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums font-extrabold text-gray-900 dark:text-white">
                        {closingBal} {item.unit}
                      </td>

                      {/* 9. Себестоимость */}
                      <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                        {formatUZS(closingBal * Number(item.costPrice))} {t("common.sum")}
                      </td>

                      {/* 10. Сумма по цене продажи */}
                      <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatUZS(closingBal * Number(item.salePrice || 0))} {t("common.sum")}
                      </td>
                    </TableRow>
                  );
                })}
              </Table>
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

      {/* Quick Operation Modal Sheet (Произв, Приход, Брак, Бонус) */}
      <ModalSheet
        open={actionItem !== null}
        onClose={() => setActionItem(null)}
        title={
          actionItem
            ? actionItem.type === "PRODUCTION"
              ? `Производство: ${actionItem.name}`
              : actionItem.type === "RESTOCK"
              ? `Приход: ${actionItem.name}`
              : actionItem.type === "DEFECT"
              ? `Списание брака: ${actionItem.name}`
              : `Бонус / Образец: ${actionItem.name}`
            : ""
        }
      >
        {actionItem && (
          <div className="flex flex-col gap-4">
            {actionItem.type === "DEFECT" && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Списание брака уменьшит остаток на складе без начисления выручки или долга.
              </p>
            )}
            {actionItem.type === "BONUS" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Бесплатная выдача бонуса или образца уменьшит остаток с сохранением имени получателя в истории движения.
              </p>
            )}
            <Input
              label="Дата операции"
              type="date"
              value={actionDate}
              onChange={(e) => setActionDate(e.target.value)}
            />
            <Input
              label={`Количество (${actionItem.unit})`}
              type="number"
              step="any"
              min="0"
              placeholder="0"
              value={actionQty}
              onChange={(e) => setActionQty(e.target.value)}
              autoFocus
            />
            {actionItem.type === "BONUS" && (
              <Input
                label="Получатель (клиент / магазин / водитель)"
                placeholder="Имя получателя..."
                value={actionRecipient}
                onChange={(e) => setActionRecipient(e.target.value)}
              />
            )}
            <Input
              label={actionItem.type === "DEFECT" ? "Причина брака / примечание" : "Примечание"}
              placeholder="Необязательно..."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <Button
              type="button"
              variant={actionItem.type === "DEFECT" ? "destructive" : "primary"}
              size="lg"
              onClick={handleActionSubmit}
              disabled={!actionQty || Number(actionQty) <= 0 || isPending}
              loading={isPending}
            >
              {actionItem.type === "PRODUCTION"
                ? "Произвести"
                : actionItem.type === "RESTOCK"
                ? "Оприходовать"
                : actionItem.type === "DEFECT"
                ? "Списать брак"
                : "Выдать бонус / образец"}
            </Button>
          </div>
        )}
      </ModalSheet>
    </div>
  );
}
