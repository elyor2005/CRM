"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
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

type ReportData = Awaited<ReturnType<typeof getBalanceReport>>;
type ProfitData = Awaited<ReturnType<typeof getProfitReport>>;

export default function ReportPage() {
  const { language, t } = useLanguage();
  const [tab, setTab] = useState<"BALANCE" | "PROFIT">("BALANCE");
  const [report, setReport] = useState<ReportData | null>(null);
  const [profit, setProfit] = useState<ProfitData | null>(null);
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
      const [r, p] = await Promise.all([
        getBalanceReport(),
        getProfitReport(),
      ]);
      setReport(r);
      setProfit(p);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      <PageHeader title={t("report.title")} />

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
                  {t("report.creditSide")}
                </h3>
                <Button
                  type="button"
                  variant="secondary"
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
        /* ─── PROFIT REPORT TAB ─── */
        <>
          {/* Net Profit Card */}
          <Card
            className={`p-6 text-center border-2 ${
              profit.netProfit >= 0
                ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40"
                : "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40"
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              {t("report.netProfit")}
            </span>
            <div
              className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums my-1.5 ${
                profit.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatUZS(profit.netProfit)}{" "}
              <span className="text-sm font-normal text-gray-500 dark:text-zinc-400">{t("common.sum")}</span>
            </div>
            <div className="text-xs font-semibold text-gray-500 dark:text-zinc-400 tabular-nums">
              {t("report.netMargin")}: {profit.netMargin}%
            </div>
          </Card>

          {/* P&L breakdown */}
          <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800/80 p-0 overflow-hidden">
            <div className="flex items-center justify-between p-4 text-sm">
              <span className="text-gray-700 dark:text-zinc-300 font-semibold">{t("report.totalSales")}</span>
              <span className="font-extrabold text-gray-900 dark:text-white text-base tabular-nums">{formatUZS(profit.totalSales)}</span>
            </div>
            {profit.totalReturns > 0 && (
              <div className="flex items-center justify-between p-4 text-sm">
                <span className="text-gray-500 dark:text-zinc-400 font-medium pl-4">− {t("report.returns")}</span>
                <span className="font-bold text-rose-500 tabular-nums">{formatUZS(profit.totalReturns)}</span>
              </div>
            )}
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
              <span className="text-gray-700 dark:text-zinc-300 font-semibold">− {t("report.operatingExpenses")}</span>
              <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatUZS(profit.operatingExpenses)}</span>
            </div>
            <div className={`flex items-center justify-between p-4 text-base font-extrabold ${profit.netProfit >= 0 ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-rose-50/50 dark:bg-rose-950/20"}`}>
              <span>{t("report.netProfit")}</span>
              <span className={`tabular-nums ${profit.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {formatUZS(profit.netProfit)} {t("common.sum")}
              </span>
            </div>
          </Card>

          {/* Expense breakdown by category */}
          {Object.keys(profit.expenseByCategory).length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
                {t("report.operatingExpenses")}
              </h3>
              <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800/80 p-0 overflow-hidden">
                {Object.entries(profit.expenseByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => (
                    <div key={cat} className="flex items-center justify-between p-3.5 text-sm">
                      <span className="text-gray-700 dark:text-zinc-300 font-semibold">
                        {t(`expenseCategories.${cat}`, cat)}
                      </span>
                      <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatUZS(amount)}</span>
                    </div>
                  ))}
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
