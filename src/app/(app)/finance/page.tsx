"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Wallet, Link as LinkIcon, Trash2, Download } from "lucide-react";
import { formatUZS, formatDateShort, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getFinanceEntries,
  createFinanceEntry,
  deleteFinanceEntry,
  getFinanceSummary,
} from "@/app/actions/finance";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableRowSkeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { PAYMENT_METHODS, EXPENSE_CATEGORIES } from "@/lib/validations";
import { exportToExcel } from "@/lib/exportExcel";
import type { FinanceType } from "@prisma/client";

type Entry = Awaited<ReturnType<typeof getFinanceEntries>>[number];

type DatePreset = "ALL" | "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

function getDateRange(preset: DatePreset): { from?: string; to?: string } {
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
      return {};
  }
}

export default function FinancePage() {
  const { language, t } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("ALL");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpense: number;
    balance: number;
    expenseByCategory?: Record<string, number>;
  }>({ totalIncome: 0, totalExpense: 0, balance: 0, expenseByCategory: {} });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Form
  const [formType, setFormType] = useState<FinanceType>("EXPENSE");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(formatDateInput(new Date()));
  const [formCategory, setFormCategory] = useState("");
  const [formMethod, setFormMethod] = useState<string>("CASH");

  const loadData = () => {
    startTransition(async () => {
      const range =
        datePreset === "CUSTOM"
          ? { from: customFrom || undefined, to: customTo || undefined }
          : getDateRange(datePreset);

      const filterVal = filter === "ALL" ? undefined : filter;
      const [e, s] = await Promise.all([
        getFinanceEntries({ filter: filterVal, dateFrom: range.from, dateTo: range.to }),
        getFinanceSummary({ dateFrom: range.from, dateTo: range.to }),
      ]);
      setEntries(e);
      setSummary(s);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [filter, datePreset, customFrom, customTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = () => {
    if (!formDesc.trim() || !formAmount || Number(formAmount) <= 0) return;
    startTransition(async () => {
      try {
        await createFinanceEntry({
          type: formType,
          description: formDesc.trim(),
          amount: formAmount,
          date: formDate,
          category: formCategory || undefined,
          paymentMethod: formMethod as any,
        });
        showToast(t("common.add"));
        setSheetOpen(false);
        setFormDesc("");
        setFormAmount("");
        setFormCategory("");
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
        await deleteFinanceEntry(deleteId);
        showToast(t("common.delete"));
        setDeleteId(null);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  // Running balance computation
  const entriesReversed = [...entries].reverse();
  const runningBalances: number[] = [];
  let runBal = 0;
  for (const entry of entriesReversed) {
    if (entry.type === "INCOME") runBal += Number(entry.amount);
    else runBal -= Number(entry.amount);
    runningBalances.push(runBal);
  }
  runningBalances.reverse();

  // Categories with activity sorted by amount descending, uncategorized at end
  const expenseCategoriesList = Object.entries(summary.expenseByCategory || {})
    .filter(([, amount]) => amount > 0)
    .sort(([catA, amtA], [catB, amtB]) => {
      if (catA === "__UNCATEGORIZED__") return 1;
      if (catB === "__UNCATEGORIZED__") return -1;
      return amtB - amtA;
    });

  const handleExportExcel = () => {
    const headers = [
      t("common.date"),
      t("common.type"),
      t("common.description"),
      t("common.category"),
      t("common.method"),
      `${t("common.amount")} (${t("common.sum")})`,
      `${t("finance.runningBalance")} (${t("common.sum")})`,
    ];

    const rows = entries.map((entry, idx) => [
      formatDateShort(entry.date, language),
      entry.type === "INCOME" ? t("finance.income") : t("finance.expense"),
      entry.description + (entry.relatedClient ? ` (${entry.relatedClient.name})` : ""),
      entry.category
        ? t(`expenseCategories.${entry.category}`, entry.category)
        : entry.type === "EXPENSE"
        ? t("common.noCategory")
        : "",
      entry.paymentMethod ? t(`paymentMethods.${entry.paymentMethod}`) : "",
      entry.type === "INCOME" ? Number(entry.amount) : -Number(entry.amount),
      runningBalances[idx] || 0,
    ]);

    const summaryRows = [
      [],
      [t("common.total"), "", "", "", "", "", ""],
      [t("finance.totalIncome"), Number(summary.totalIncome)],
      [t("finance.totalExpense"), Number(summary.totalExpense)],
      [t("finance.balance"), Number(summary.balance)],
    ];

    exportToExcel(`Финансы_${formatDateInput(new Date())}`, [
      {
        name: "Финансы",
        data: [headers, ...rows, ...summaryRows],
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("finance.title")}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={handleExportExcel}
              disabled={entries.length === 0}
              className="min-h-[44px] gap-2 px-3.5 bg-white dark:bg-[#131823] border-gray-200/80 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 shadow-xs"
            >
              <Download size={16} className="text-gray-500 dark:text-zinc-400" />
              <span className="text-xs sm:text-sm font-bold">{t("common.exportExcel")}</span>
            </Button>
            <Button
              onClick={() => {
                setFormType("EXPENSE");
                setFormDesc("");
                setFormAmount("");
                setFormDate(formatDateInput(new Date()));
                setFormCategory("");
                setFormMethod("CASH");
                setSheetOpen(true);
              }}
              size="md"
            >
              <Plus size={18} /> {t("finance.newEntry")}
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="p-4 text-center">
          <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">{t("finance.totalIncome")}</div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatUZS(summary.totalIncome)}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">{t("finance.totalExpense")}</div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">{formatUZS(summary.totalExpense)}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">{t("finance.balance")}</div>
          <div className={`text-xl sm:text-2xl font-extrabold tabular-nums ${summary.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {formatUZS(summary.balance)}
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[
            { value: "ALL", label: t("common.all") },
            { value: "INCOME", label: t("finance.income") },
            { value: "EXPENSE", label: t("finance.expense") },
          ]}
        />
        <SegmentedControl
          value={datePreset}
          onChange={(v) => setDatePreset(v as DatePreset)}
          options={[
            { value: "ALL", label: t("common.all") },
            { value: "TODAY", label: t("common.today") },
            { value: "WEEK", label: t("common.thisWeek") },
            { value: "MONTH", label: t("common.thisMonth") },
            { value: "CUSTOM", label: t("common.custom") },
          ]}
        />
      </div>

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

      {/* Task Group 4: Расходы по категориям breakdown */}
      {filter !== "INCOME" && expenseCategoriesList.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
            {language === "ru" ? "Расходы по категориям" : language === "uz" ? "Kategoriyalar bo'yicha xarajatlar" : "Expenses by Category"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {expenseCategoriesList.map(([cat, amount]) => (
              <Card key={cat} className="p-3 bg-white dark:bg-[#131823] border border-gray-200/80 dark:border-zinc-800">
                <div className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 truncate mb-1" title={cat === "__UNCATEGORIZED__" ? t("common.noCategory") : t(`expenseCategories.${cat}`, cat)}>
                  {cat === "__UNCATEGORIZED__" ? t("common.noCategory") : t(`expenseCategories.${cat}`, cat)}
                </div>
                <div className="text-sm font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatUZS(amount)} <span className="text-[10px] font-normal text-gray-400">{t("common.sum")}</span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Finance Records Table */}
      {loading ? (
        <div className="bg-white dark:bg-[#131823] rounded-2xl border border-gray-200/80 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Wallet size={28} />}
          title={t("common.noData")}
          actionLabel={t("finance.newEntry")}
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <Table
          headers={[
            t("common.date"),
            t("common.type"),
            t("common.description"),
            t("common.category"),
            t("common.method"),
            t("common.amount"),
            t("finance.runningBalance"),
            "",
          ]}
          alignments={["left", "left", "left", "left", "left", "right", "right", "center"]}
        >
          {entries.map((entry, idx) => {
            const isIncome = entry.type === "INCOME";
            const isLinked = !!entry.relatedSaleId;
            return (
              <TableRow
                key={entry.id}
                onClick={!isLinked ? () => setDeleteId(entry.id) : undefined}
              >
                <td className="p-3.5 whitespace-nowrap text-gray-700 dark:text-zinc-300 font-medium">
                  {formatDateShort(entry.date, language)}
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <Badge variant={isIncome ? "income" : "expense"}>
                    {isIncome ? t("finance.income") : t("finance.expense")}
                  </Badge>
                </td>
                <td className="p-3.5 text-gray-900 dark:text-white font-semibold">
                  <div className="flex items-center gap-1.5">
                    {entry.description}
                    {isLinked && <LinkIcon size={12} className="text-gray-400 shrink-0" />}
                  </div>
                  {entry.relatedClient && (
                    <div className="text-xs text-gray-500 dark:text-zinc-400 font-normal">{entry.relatedClient.name}</div>
                  )}
                </td>
                <td className="p-3.5 whitespace-nowrap text-gray-500 dark:text-zinc-400 text-xs font-semibold">
                  {entry.category ? t(`expenseCategories.${entry.category}`, entry.category) : "—"}
                </td>
                <td className="p-3.5 whitespace-nowrap text-gray-500 dark:text-zinc-400 text-xs font-semibold">
                  {entry.paymentMethod ? t(`paymentMethods.${entry.paymentMethod}`) : "—"}
                </td>
                <td className={`p-3.5 text-right whitespace-nowrap font-extrabold tabular-nums ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {isIncome ? "+" : "−"}{formatUZS(entry.amount)}
                </td>
                <td className="p-3.5 text-right whitespace-nowrap text-gray-500 dark:text-zinc-400 font-medium text-xs tabular-nums">
                  {formatUZS(runningBalances[idx] || 0)}
                </td>
                <td className="p-3.5 text-center">
                  {!isLinked && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(entry.id); }}
                      className="text-gray-400 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </TableRow>
            );
          })}
        </Table>
      )}

      {/* Add Finance Entry Modal Sheet */}
      <ModalSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t("finance.newEntry")}
      >
        <div className="flex flex-col gap-4">
          <div className="w-full">
            <SegmentedControl
              value={formType}
              onChange={(v) => {
                setFormType(v as FinanceType);
                if (v === "INCOME") setFormCategory("");
              }}
              options={[
                { value: "EXPENSE", label: t("finance.expense") },
                { value: "INCOME", label: t("finance.income") },
              ]}
            />
          </div>

          <Input
            label={t("common.description")}
            placeholder={`${t("common.description")}...`}
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            autoFocus
          />

          <Input
            label={t("common.amount")}
            type="number"
            step="any"
            min="0"
            placeholder="0"
            value={formAmount}
            onChange={(e) => setFormAmount(e.target.value)}
          />

          <Input
            label={t("common.date")}
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
          />

          {formType === "EXPENSE" && (
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 pl-0.5">
                {t("common.category")}
              </label>
              <select
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-[#1E2638] text-gray-900 dark:text-white rounded-xl text-base border border-gray-200/60 dark:border-zinc-800 outline-none transition-all focus:ring-2 focus:ring-indigo-500/80 min-h-[44px]"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                <option value="">{t("common.select")}...</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`expenseCategories.${cat}`)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 pl-0.5">
              {t("common.method")}
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-[#1E2638] text-gray-900 dark:text-white rounded-xl text-base border border-gray-200/60 dark:border-zinc-800 outline-none transition-all focus:ring-2 focus:ring-indigo-500/80 min-h-[44px]"
              value={formMethod}
              onChange={(e) => setFormMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`paymentMethods.${m}`)}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={!formDesc.trim() || !formAmount || Number(formAmount) <= 0}
            loading={isPending}
          >
            {t("common.add")}
          </Button>
        </div>
      </ModalSheet>

      {/* Delete confirmation dialog */}
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
