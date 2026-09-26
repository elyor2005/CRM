"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Trash2, Download, Calendar } from "lucide-react";
import { formatUZS, formatDateShort, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getBalanceReport,
  createLiabilityEntry,
  deleteLiabilityEntry,
} from "@/app/actions/report";
import { getProfitReport } from "@/app/actions/profit";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { exportToExcel } from "@/lib/exportExcel";

type ReportData = Awaited<ReturnType<typeof getBalanceReport>>;
type ProfitData = Awaited<ReturnType<typeof getProfitReport>>;
type ProfitDatePreset = "WEEK" | "MONTH" | "CUSTOM";

function getProfitDateRange(preset: ProfitDatePreset): { from: string; to: string } {
  const now = new Date();
  const today = formatDateInput(now);
  switch (preset) {
    case "WEEK": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { from: formatDateInput(weekAgo), to: today };
    }
    case "MONTH": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatDateInput(monthStart), to: today };
    }
    default: {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatDateInput(monthStart), to: today };
    }
  }
}

export default function ReportPage() {
  const { language, t } = useLanguage();
  const [tab, setTab] = useState<"BALANCE" | "PROFIT">("BALANCE");
  const [report, setReport] = useState<ReportData | null>(null);
  const [profit, setProfit] = useState<ProfitData | null>(null);

  // 8a: Historical date for balance report
  const [balanceDate, setBalanceDate] = useState(formatDateInput(new Date()));

  // 8b: Profit report period range picker (default this month)
  const [profitDatePreset, setProfitDatePreset] = useState<ProfitDatePreset>("MONTH");
  const [profitCustomFrom, setProfitCustomFrom] = useState("");
  const [profitCustomTo, setProfitCustomTo] = useState("");

  // 8d: Expense categories include/exclude toggles (live client-side recalculation)
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Form
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(formatDateInput(new Date()));

  const loadData = () => {
    startTransition(async () => {
      const pRange =
        profitDatePreset === "CUSTOM"
          ? {
              from: profitCustomFrom || formatDateInput(new Date()),
              to: profitCustomTo || formatDateInput(new Date()),
            }
          : getProfitDateRange(profitDatePreset);

      const [r, p] = await Promise.all([
        getBalanceReport({ asOfDate: balanceDate || undefined }),
        getProfitReport({ dateFrom: pRange.from, dateTo: pRange.to }),
      ]);
      setReport(r);
      setProfit(p);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [balanceDate, profitDatePreset, profitCustomFrom, profitCustomTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCategory = (cat: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formAmount || Number(formAmount) <= 0) return;
    startTransition(async () => {
      try {
        await createLiabilityEntry({
          name: formName.trim(),
          amount: formAmount,
          date: formDate,
        });
        showToast(t("common.add"));
        setSheetOpen(false);
        setFormName("");
        setFormAmount("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    startTransition(async () => {
      try {
        await deleteLiabilityEntry(deleteId);
        showToast(t("common.delete"));
        setDeleteId(null);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  // Live recalculated operating expenses and net profit (8d)
  const includedExpenses = profit
    ? Object.entries(profit.expenseByCategory).reduce((sum, [cat, amt]) => {
        if (!excludedCategories.has(cat)) return sum + amt;
        return sum;
      }, 0)
    : 0;

  const liveNetProfit = profit ? profit.grossProfit - includedExpenses : 0;
  const liveNetMargin =
    profit && profit.netSales > 0
      ? Math.round((liveNetProfit / profit.netSales) * 1000) / 10
      : 0;

  const handleExportExcel = () => {
    if (tab === "BALANCE" && report) {
      const debitRows = [
        [t("report.debitSide"), ""],
        [t("warehouse.finishedGoods"), report.debit.finishedGoods],
        [t("warehouse.rawMaterials"), report.debit.rawMaterials],
        [t("warehouse.packaging"), report.debit.packaging],
        [t("report.cashBalance"), report.debit.cash],
        [t("report.receivables"), report.debit.receivables],
        [t("common.total") + " (" + t("report.debitSide") + ")", report.debit.total],
      ];

      const creditRows = [
        [],
        [t("report.creditSide"), ""],
        ...report.credit.liabilities.map((l) => [
          `${l.name} (${formatDateShort(l.date, language)})`,
          Number(l.amount),
        ]),
        [t("common.total") + " (" + t("report.creditSide") + ")", report.credit.total],
      ];

      const summaryRows = [
        [],
        [t("report.netBalance"), report.netBalance],
      ];

      exportToExcel(`Отчёт_Баланс_${balanceDate}`, [
        {
          name: "Баланс",
          data: [
            [`Баланс на дату: ${balanceDate}`],
            [],
            ...debitRows,
            ...creditRows,
            ...summaryRows,
          ],
        },
      ]);
    } else if (tab === "PROFIT" && profit) {
      const pnlRows = [
        [t("report.totalSales") + " (Net)", profit.netSales],
        [t("report.cogs"), profit.cogs],
        [t("report.grossProfit"), profit.grossProfit],
        [t("report.operatingExpenses"), includedExpenses],
        [t("report.netProfit"), liveNetProfit],
        [t("report.netMargin"), `${liveNetMargin}%`],
      ];

      const expenseRows = [
        [],
        ["Операционные расходы по категориям", "Сумма", "Включено в расчет"],
        ...Object.entries(profit.expenseByCategory).map(([cat, amt]) => [
          cat === "__UNCATEGORIZED__" ? t("common.noCategory") : t(`expenseCategories.${cat}`, cat),
          amt,
          excludedCategories.has(cat) ? "Нет" : "Да",
        ]),
      ];

      exportToExcel(`Отчёт_Прибыль_${formatDateInput(new Date())}`, [
        {
          name: "Отчёт о прибыли",
          data: [["Показатель", "Значение"], ...pnlRows, ...expenseRows],
        },
      ]);
    }
  };

  if (loading || !report || !profit) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("report.title")} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("report.title")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {tab === "BALANCE" ? (
              /* 8a. Historical Balance Date Picker (Unified Premium Capsule) */
              <div className="flex items-center bg-white dark:bg-[#131823] border border-gray-200/80 dark:border-zinc-800 rounded-xl px-3.5 py-2 shadow-xs hover:border-gray-300 dark:hover:border-zinc-700 transition-all gap-2.5 min-h-[44px]">
                <Calendar size={16} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                  {language === "ru" ? "На дату:" : language === "uz" ? "Sana:" : "As of:"}
                </span>
                <input
                  type="date"
                  value={balanceDate}
                  onChange={(e) => setBalanceDate(e.target.value)}
                  className="bg-transparent text-gray-900 dark:text-white text-xs sm:text-sm font-bold outline-none cursor-pointer dark:[color-scheme:dark]"
                />
              </div>
            ) : (
              /* 8b. Profit Report Period Range Picker */
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  value={profitDatePreset}
                  onChange={(v) => setProfitDatePreset(v as ProfitDatePreset)}
                  options={[
                    { value: "WEEK", label: t("common.thisWeek") },
                    { value: "MONTH", label: t("common.thisMonth") },
                    { value: "CUSTOM", label: t("common.custom") },
                  ]}
                />
                {profitDatePreset === "CUSTOM" && (
                  <div className="flex items-center bg-white dark:bg-[#131823] border border-gray-200/80 dark:border-zinc-800 rounded-xl px-3 py-1.5 gap-2 min-h-[44px] shadow-xs">
                    <input
                      type="date"
                      value={profitCustomFrom}
                      onChange={(e) => setProfitCustomFrom(e.target.value)}
                      className="bg-transparent text-gray-900 dark:text-white text-xs sm:text-sm font-semibold outline-none cursor-pointer dark:[color-scheme:dark]"
                    />
                    <span className="text-xs text-gray-400 font-bold">—</span>
                    <input
                      type="date"
                      value={profitCustomTo}
                      onChange={(e) => setProfitCustomTo(e.target.value)}
                      className="bg-transparent text-gray-900 dark:text-white text-xs sm:text-sm font-semibold outline-none cursor-pointer dark:[color-scheme:dark]"
                    />
                  </div>
                )}
              </div>
            )}

            <Button
              variant="outline"
              size="md"
              onClick={handleExportExcel}
              className="min-h-[44px] gap-2 px-3.5 bg-white dark:bg-[#131823] border-gray-200/80 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 shadow-xs"
            >
              <Download size={16} className="text-gray-500 dark:text-zinc-400" />
              <span className="text-xs sm:text-sm font-bold">{t("common.exportExcel")}</span>
            </Button>
          </div>
        }
      />

      {/* Tab switcher */}
      <div className="max-w-xs">
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { value: "BALANCE", label: t("report.balanceReport") },
            { value: "PROFIT", label: t("report.profitReport") },
          ]}
        />
      </div>

      {tab === "BALANCE" ? (
        <>
          {/* Net Balance Card */}
          <Card
            className={`p-6 text-center border-2 ${
              report.netBalance >= 0
                ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40"
                : "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40"
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              {t("report.netBalance")}
            </span>
            <div
              className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums my-1.5 ${
                report.netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatUZS(report.netBalance)}{" "}
              <span className="text-sm font-normal text-gray-500 dark:text-zinc-400">{t("common.sum")}</span>
            </div>
            <div className="text-xs font-semibold text-gray-500 dark:text-zinc-400 tabular-nums">
              {t("report.debitSide")}: {formatUZS(report.debit.total)} − {t("report.creditSide")}:{" "}
              {formatUZS(report.credit.total)}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DEBIT Column */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 dark:text-white px-1">
                {t("report.debitSide")}
              </h3>
              <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800/80 p-0 overflow-hidden">
                <div className="flex items-center justify-between p-3.5 text-sm">
                  <span className="text-gray-700 dark:text-zinc-300 font-medium">{t("warehouse.finishedGoods")}</span>
                  <span className="font-extrabold text-gray-900 dark:text-white tabular-nums">{formatUZS(report.debit.finishedGoods)}</span>
                </div>
                <div className="flex items-center justify-between p-3.5 text-sm">
                  <span className="text-gray-700 dark:text-zinc-300 font-medium">{t("warehouse.rawMaterials")}</span>
                  <span className="font-extrabold text-gray-900 dark:text-white tabular-nums">{formatUZS(report.debit.rawMaterials)}</span>
                </div>
                <div className="flex items-center justify-between p-3.5 text-sm">
                  <span className="text-gray-700 dark:text-zinc-300 font-medium">{t("warehouse.packaging")}</span>
                  <span className="font-extrabold text-gray-900 dark:text-white tabular-nums">{formatUZS(report.debit.packaging)}</span>
                </div>
                <div className="flex items-center justify-between p-3.5 text-sm">
                  <span className="text-gray-700 dark:text-zinc-300 font-medium">{t("report.cashBalance")}</span>
                  <span className={`font-extrabold tabular-nums ${report.debit.cash >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {formatUZS(report.debit.cash)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3.5 text-sm">
                  <span className="text-gray-700 dark:text-zinc-300 font-medium">{t("report.receivables")}</span>
                  <span className="font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">{formatUZS(report.debit.receivables)}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50/80 dark:bg-zinc-800/60 text-base font-extrabold">
                  <span>{t("common.total")}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {formatUZS(report.debit.total)} {t("common.sum")}
                  </span>
                </div>
              </Card>
            </div>

            {/* CREDIT Column */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 dark:text-white">
                  {t("report.creditSide")} ({report.credit.liabilities.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormName("");
                    setFormAmount("");
                    setFormDate(formatDateInput(new Date()));
                    setSheetOpen(true);
                  }}
                >
                  <Plus size={16} /> {t("common.add")}
                </Button>
              </div>

              <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800/80 p-0 overflow-hidden">
                {report.credit.liabilities.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">{t("common.noData")}</div>
                ) : (
                  report.credit.liabilities.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => setDeleteId(entry.id)}
                      className="flex items-center justify-between p-3.5 text-sm cursor-pointer hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{entry.name}</div>
                        <div className="text-xs text-gray-500 dark:text-zinc-400">{formatDateShort(entry.date, language)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">{formatUZS(entry.amount)}</span>
                        <Trash2 size={16} className="text-gray-400 hover:text-rose-500" />
                      </div>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between p-4 bg-gray-50/80 dark:bg-zinc-800/60 text-base font-extrabold">
                  <span>{t("common.total")}</span>
                  <span className="text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatUZS(report.credit.total)} {t("common.sum")}
                  </span>
                </div>
              </Card>
            </div>
          </div>
        </>
      ) : (
        /* ─── PROFIT REPORT TAB (Task 8b, 8c, 8d) ─── */
        <>
          {/* Net Profit Card (Live updated) */}
          <Card
            className={`p-6 text-center border-2 ${
              liveNetProfit >= 0
                ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40"
                : "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40"
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              {t("report.netProfit")}
            </span>
            <div
              className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums my-1.5 ${
                liveNetProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatUZS(liveNetProfit)}{" "}
              <span className="text-sm font-normal text-gray-500 dark:text-zinc-400">{t("common.sum")}</span>
            </div>
            <div className="text-xs font-semibold text-gray-500 dark:text-zinc-400 tabular-nums">
              {t("report.netMargin")}: {liveNetMargin}%
            </div>
          </Card>

          {/* 8c. Fixed P&L breakdown (no duplicate subtraction of returns) */}
          <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800/80 p-0 overflow-hidden">
            <div className="flex items-center justify-between p-4 text-sm">
              <span className="text-gray-700 dark:text-zinc-300 font-semibold">
                {t("report.totalSales")} {profit.totalReturns > 0 && <span className="text-xs font-normal text-gray-500">({language === "ru" ? "чистый объём" : language === "uz" ? "sof tushum" : "net"})</span>}
              </span>
              <span className="font-extrabold text-gray-900 dark:text-white text-base tabular-nums">
                {formatUZS(profit.netSales)}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 text-sm">
              <span className="text-gray-700 dark:text-zinc-300 font-semibold">− {t("report.cogs")}</span>
              <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatUZS(profit.cogs)}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-indigo-50/40 dark:bg-indigo-950/20 text-sm">
              <span className="font-bold text-gray-900 dark:text-white">{t("report.grossProfit")}</span>
              <div className="text-right">
                <span className={`font-extrabold text-base tabular-nums ${profit.grossProfit >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {formatUZS(profit.grossProfit)}
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-400 ml-1 font-semibold tabular-nums">({profit.profitMargin}%)</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 text-sm">
              <span className="text-gray-700 dark:text-zinc-300 font-semibold">
                − {t("report.operatingExpenses")} {excludedCategories.size > 0 && <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">({language === "ru" ? "с фильтром" : "filtered"})</span>}
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatUZS(includedExpenses)}</span>
            </div>
            <div className={`flex items-center justify-between p-4 text-base font-extrabold ${liveNetProfit >= 0 ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-rose-50/50 dark:bg-rose-950/20"}`}>
              <span>{t("report.netProfit")}</span>
              <span className={`tabular-nums ${liveNetProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {formatUZS(liveNetProfit)} {t("common.sum")}
              </span>
            </div>
          </Card>

          {/* 8d. Expanded Expense Categories with Include/Exclude Toggles */}
          {Object.keys(profit.expenseByCategory).length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  {t("report.operatingExpenses")} ({Object.keys(profit.expenseByCategory).length})
                </h3>
                <span className="text-xs text-gray-400">
                  {language === "ru" ? "Снимите галочку для исключения из расчёта" : language === "uz" ? "Hisobdan chiqarish uchun belgilang" : "Uncheck to exclude from profit calc"}
                </span>
              </div>
              <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800/80 p-0 overflow-hidden">
                {Object.entries(profit.expenseByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => {
                    const isChecked = !excludedCategories.has(cat);
                    const label =
                      cat === "__UNCATEGORIZED__"
                        ? t("common.noCategory")
                        : t(`expenseCategories.${cat}`, cat);

                    return (
                      <label
                        key={cat}
                        className="flex items-center justify-between p-3.5 text-sm cursor-pointer hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCategory(cat)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 dark:bg-zinc-800 dark:border-zinc-700"
                          />
                          <span className={`font-semibold ${isChecked ? "text-gray-900 dark:text-white" : "text-gray-400 line-through"}`}>
                            {label}
                          </span>
                        </div>
                        <span className={`font-bold tabular-nums ${isChecked ? "text-rose-600 dark:text-rose-400" : "text-gray-400"}`}>
                          {formatUZS(amount)}
                        </span>
                      </label>
                    );
                  })}
              </Card>
            </section>
          )}
        </>
      )}

      {/* Add Liability Modal Sheet */}
      <ModalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t("report.addLiability")}>
        <div className="flex flex-col gap-4">
          <Input label={t("report.liabilityName")} placeholder="..." value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
          <Input label={t("common.amount")} type="number" step="any" min="0" placeholder="0" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
          <Input label={t("common.date")} type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          <Button type="button" variant="primary" size="lg" onClick={handleSubmit} disabled={!formName.trim() || !formAmount || Number(formAmount) <= 0} loading={isPending}>
            {t("common.add")}
          </Button>
        </div>
      </ModalSheet>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        title={t("common.delete")}
        message={t("common.confirmDelete")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
