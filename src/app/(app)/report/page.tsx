"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatUZS, formatDateShort, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getBalanceReport,
  createLiabilityEntry,
  deleteLiabilityEntry,
} from "@/app/actions/report";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ReportData = Awaited<ReturnType<typeof getBalanceReport>>;

export default function ReportPage() {
  const { language, t } = useLanguage();
  const [report, setReport] = useState<ReportData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  // Form
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(formatDateInput(new Date()));

  const loadData = () => {
    startTransition(async () => {
      const data = await getBalanceReport();
      setReport(data);
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

  if (!report) {
    return (
      <>
        <PageHeader title={t("report.title")} />
        <div className="py-12 text-center text-gray-500 font-medium">{t("common.loading")}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("report.title")} />

      {/* Net Balance Card */}
      <Card
        className={`mb-8 p-6 text-center border-2 ${
          report.netBalance >= 0
            ? "bg-gradient-to-br from-emerald-50/60 to-blue-50/60 dark:from-zinc-900 dark:to-zinc-900 border-emerald-200/50 dark:border-zinc-800"
            : "bg-gradient-to-br from-red-50/60 to-amber-50/60 dark:from-zinc-900 dark:to-zinc-900 border-red-200/50 dark:border-zinc-800"
        }`}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
          {t("report.netBalance")}
        </span>
        <div
          className={`text-3xl sm:text-4xl font-extrabold tracking-tight my-1 ${
            report.netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {formatUZS(report.netBalance)}{" "}
          <span className="text-sm font-normal text-gray-500">{t("common.sum")}</span>
        </div>
        <div className="text-xs font-semibold text-gray-500">
          {t("report.debitSide")}: {formatUZS(report.debit.total)} − {t("report.creditSide")}:{" "}
          {formatUZS(report.credit.total)}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* DEBIT Column */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white px-1">
            {t("report.debitSide")}
          </h3>

          <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800 p-0 overflow-hidden">
            <div className="flex items-center justify-between p-3.5 text-sm">
              <span className="text-gray-700 dark:text-zinc-300">{t("warehouse.finishedGoods")}</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatUZS(report.debit.finishedGoods)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3.5 text-sm">
              <span className="text-gray-700 dark:text-zinc-300">{t("warehouse.rawMaterials")}</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatUZS(report.debit.rawMaterials)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3.5 text-sm">
              <span className="text-gray-700 dark:text-zinc-300">{t("warehouse.packaging")}</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatUZS(report.debit.packaging)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3.5 text-sm">
              <span className="text-gray-700 dark:text-zinc-300">{t("report.cashBalance")}</span>
              <span
                className={`font-bold ${
                  report.debit.cash >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatUZS(report.debit.cash)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3.5 text-sm">
              <span className="text-gray-700 dark:text-zinc-300">{t("report.receivables")}</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {formatUZS(report.debit.receivables)}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/60 text-base font-extrabold">
              <span>{t("common.total")}</span>
              <span className="text-blue-600 dark:text-blue-400">
                {formatUZS(report.debit.total)} {t("common.sum")}
              </span>
            </div>
          </Card>
        </div>

        {/* CREDIT Column */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
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

          <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800 p-0 overflow-hidden">
            {report.credit.liabilities.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">{t("common.noData")}</div>
            ) : (
              report.credit.liabilities.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setDeleteId(entry.id)}
                  className="flex items-center justify-between p-3.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{entry.name}</div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400">
                      {formatDateShort(entry.date, language)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {formatUZS(entry.amount)}
                    </span>
                    <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
                  </div>
                </div>
              ))
            )}

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/60 text-base font-extrabold">
              <span>{t("common.total")}</span>
              <span className="text-red-600 dark:text-red-400">
                {formatUZS(report.credit.total)} {t("common.sum")}
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Add Liability Modal Sheet */}
      <ModalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t("report.addLiability")}>
        <div className="flex flex-col gap-4">
          <Input
            label={t("report.liabilityName")}
            placeholder="..."
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
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
            disabled={!formName.trim() || !formAmount || Number(formAmount) <= 0}
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
