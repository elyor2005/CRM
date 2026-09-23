"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Wallet, Link as LinkIcon, Trash2 } from "lucide-react";
import { formatUZS, formatDateShort, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getFinanceEntries,
  createFinanceEntry,
  deleteFinanceEntry,
  getCashBalance,
} from "@/app/actions/finance";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { FinanceType } from "@prisma/client";

type Entry = Awaited<ReturnType<typeof getFinanceEntries>>[number];

export default function FinancePage() {
  const { language, t } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [cashBalance, setCashBalance] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  // Form
  const [formType, setFormType] = useState<FinanceType>("INCOME");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(formatDateInput(new Date()));

  const loadData = () => {
    startTransition(async () => {
      const filterVal = filter === "ALL" ? undefined : filter;
      const [e, b] = await Promise.all([
        getFinanceEntries(filterVal),
        getCashBalance(),
      ]);
      setEntries(e);
      setCashBalance(b);
    });
  };

  useEffect(() => {
    loadData();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = () => {
    if (!formDesc.trim() || !formAmount || Number(formAmount) <= 0) return;
    startTransition(async () => {
      try {
        await createFinanceEntry({
          type: formType,
          description: formDesc.trim(),
          amount: formAmount,
          date: formDate,
        });
        showToast(t("common.add"));
        setSheetOpen(false);
        setFormDesc("");
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
        await deleteFinanceEntry(deleteId);
        showToast(t("common.delete"));
        setDeleteId(null);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  const entriesReversed = [...entries].reverse();
  const runningBalances: number[] = [];
  let runBal = 0;
  for (const entry of entriesReversed) {
    if (entry.type === "INCOME") {
      runBal += Number(entry.amount);
    } else {
      runBal -= Number(entry.amount);
    }
    runningBalances.push(runBal);
  }
  runningBalances.reverse();

  return (
    <>
      <PageHeader
        title={t("finance.title")}
        subtitle={
          <span>
            {t("finance.balance")}:{" "}
            <strong className={cashBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              {formatUZS(cashBalance)} {t("common.sum")}
            </strong>
          </span>
        }
        action={
          <Button
            onClick={() => {
              setFormType("EXPENSE");
              setFormDesc("");
              setFormAmount("");
              setFormDate(formatDateInput(new Date()));
              setSheetOpen(true);
            }}
            size="md"
          >
            <Plus size={18} /> {t("finance.newEntry")}
          </Button>
        }
      />

      {/* Segmented Filter */}
      <div className="mb-6 max-w-xs">
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[
            { value: "ALL", label: t("common.all") },
            { value: "INCOME", label: t("finance.income") },
            { value: "EXPENSE", label: t("finance.expense") },
          ]}
        />
      </div>

      {/* Finance ledger cards */}
      {entries.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 mb-3">
            <Wallet size={28} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("common.noData")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 mb-4">
            {t("finance.newEntry")}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {entries.map((entry, idx) => {
            const isIncome = entry.type === "INCOME";
            const isLinked = !!entry.relatedSaleId;

            return (
              <Card
                key={entry.id}
                hoverable={!isLinked}
                onClick={() => {
                  if (!isLinked) setDeleteId(entry.id);
                }}
                className="flex items-center justify-between p-4"
              >
                <div className="flex flex-col gap-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {entry.description}
                    </span>
                    {isLinked && (
                      <LinkIcon size={14} className="text-gray-400 shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    {formatDateShort(entry.date, language)}
                    {entry.relatedClient && ` · ${entry.relatedClient.name}`}
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`font-extrabold text-base ${
                      isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {isIncome ? "+" : "−"}
                    {formatUZS(entry.amount)}
                  </div>
                  <div className="text-xs text-gray-400 font-medium">
                    {formatUZS(runningBalances[idx] || 0)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={() => {
          setFormType("EXPENSE");
          setFormDesc("");
          setFormAmount("");
          setFormDate(formatDateInput(new Date()));
          setSheetOpen(true);
        }}
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        <Plus size={26} />
      </button>

      {/* Add Entry Modal Sheet */}
      <ModalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t("finance.newEntry")}>
        <div className="flex flex-col gap-4">
          <SegmentedControl
            value={formType}
            onChange={setFormType}
            options={[
              { value: "INCOME", label: t("finance.income") },
              { value: "EXPENSE", label: t("finance.expense") },
            ]}
          />
          <Input
            label={t("finance.description")}
            placeholder="..."
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
    </>
  );
}
