"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { formatUZS, formatDateShort, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createLiabilityEntry,
  deleteLiabilityEntry,
} from "@/app/actions/report";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { getLiabilities } from "@/app/actions/liabilities";

type LiabilityEntry = Awaited<ReturnType<typeof getLiabilities>>[number];

export default function LiabilitiesPage() {
  const { language, t } = useLanguage();
  const [entries, setEntries] = useState<LiabilityEntry[]>([]);
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
      const data = await getLiabilities();
      setEntries(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalLiabilities = entries.reduce((sum, e) => sum + Number(e.amount), 0);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("liabilities.title")}
        action={
          <Button
            onClick={() => {
              setFormName("");
              setFormAmount("");
              setFormDate(formatDateInput(new Date()));
              setSheetOpen(true);
            }}
            size="md"
          >
            <Plus size={18} /> {t("common.add")}
          </Button>
        }
      />

      {/* Total */}
      <Card className="p-4 text-center">
        <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">
          {t("liabilities.totalLiabilities")}
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
          {formatUZS(totalLiabilities)} {t("common.sum")}
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={28} />}
          title={t("common.noData")}
          actionLabel={t("common.add")}
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <Card className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800/80 p-0 overflow-hidden">
          {entries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => setDeleteId(entry.id)}
              className="flex items-center justify-between p-4 text-sm cursor-pointer hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors"
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
          ))}
        </Card>
      )}

      {/* Add Modal */}
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
