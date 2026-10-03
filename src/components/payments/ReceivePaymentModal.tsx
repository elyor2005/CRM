"use client";

import { useState, useTransition, useEffect } from "react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/lib/i18n/context";
import { formatDateInput } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/validations";
import { createPayment } from "@/app/actions/payments";
import { getClientsWithDebt } from "@/app/actions/clients";

interface ReceivePaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedClientId?: string;
}

export function ReceivePaymentModal({
  open,
  onClose,
  onSuccess,
  preselectedClientId,
}: ReceivePaymentModalProps) {
  const { language, t } = useLanguage();
  const { showToast, dismissToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [clients, setClients] = useState<Array<{ id: string; name: string; currentDebt?: number }>>([]);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(formatDateInput(new Date()));
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER" | "CARD" | "OTHER">("CASH");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      getClientsWithDebt({ tab: preselectedClientId ? "ALL" : "ACTIVE" }).then((list) => {
        setClients(list.map((c) => ({ id: c.id, name: c.name, currentDebt: c.debt })));
      });
      if (preselectedClientId) {
        setSelectedClientId(preselectedClientId);
      }
    }
  }, [open, preselectedClientId]);

  const handleSubmit = () => {
    if (!selectedClientId) {
      showToast(t("sales.selectClient"), "error");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      showToast(t("common.amount"), "error");
      return;
    }

    const toastId = showToast(
      language === "ru" ? "Сохранение..." : language === "uz" ? "Saqlanmoqda..." : "Saving...",
      { type: "loading", duration: 15000 }
    );

    startTransition(async () => {
      try {
        await createPayment({
          clientId: selectedClientId,
          amount,
          date,
          method,
          note,
        });

        dismissToast(toastId);
        showToast(
          language === "ru" ? "Оплата сохранена" : language === "uz" ? "To'lov saqlandi" : "Payment saved",
          "success"
        );
        onClose();
        setAmount("");
        setNote("");
        setMethod("CASH");
        setSelectedClientId("");
        if (onSuccess) onSuccess();
      } catch (e) {
        dismissToast(toastId);
        showToast(
          e instanceof Error ? e.message : (language === "ru" ? "Не удалось сохранить оплату" : "Failed to save payment"),
          {
            type: "error",
            duration: 7000,
            action: {
              label: language === "ru" ? "Повторить" : language === "uz" ? "Qayta urinish" : "Retry",
              onClick: () => handleSubmit(),
            },
          }
        );
      }
    });
  };

  const clientOptions = clients.map((c) => ({
    id: c.id,
    label: c.name,
    subtitle: c.currentDebt != null && c.currentDebt > 0 ? `Долг: ${Math.round(c.currentDebt).toLocaleString()} сум` : undefined,
  }));

  return (
    <ModalSheet open={open} onClose={onClose} title={t("debts.newPayment")}>
      <div className="flex flex-col gap-4">
        {/* Client selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 pl-0.5">
            {t("sales.client")}
          </label>
          <SearchableSelect
            options={clientOptions}
            value={selectedClientId}
            onChange={setSelectedClientId}
            placeholder={t("sales.selectClient")}
          />
        </div>

        <Input
          label={t("common.amount")}
          type="number"
          step="any"
          min="0"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />

        <Input
          label={t("common.date")}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 pl-0.5">
            {t("common.method")}
          </label>
          <select
            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-[#1E2638] text-gray-900 dark:text-white rounded-xl text-base border border-gray-200/60 dark:border-zinc-800 outline-none transition-all focus:ring-2 focus:ring-indigo-500/80 min-h-[44px]"
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`paymentMethods.${m}`)}
              </option>
            ))}
          </select>
        </div>

        <Input
          label={t("common.notes")}
          placeholder="..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={!selectedClientId || !amount || Number(amount) <= 0}
          loading={isPending}
        >
          {t("debts.addPayment")}
        </Button>
      </div>
    </ModalSheet>
  );
}
