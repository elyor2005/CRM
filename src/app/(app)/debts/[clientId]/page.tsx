"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, ShoppingCart, CreditCard } from "lucide-react";
import { formatUZS, formatDateShort, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/components/ui/Toast";
import { getClient, getClientHistory, getClientDebt } from "@/app/actions/clients";
import { createPayment } from "@/app/actions/payments";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ClientType = NonNullable<Awaited<ReturnType<typeof getClient>>>;
type HistoryType = Awaited<ReturnType<typeof getClientHistory>>;

export default function ClientDetailPage() {
  const { language, t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const [client, setClient] = useState<ClientType | null>(null);
  const [history, setHistory] = useState<HistoryType | null>(null);
  const [debt, setDebt] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(formatDateInput(new Date()));
  const [paymentNote, setPaymentNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const loadData = () => {
    startTransition(async () => {
      const [c, h, d] = await Promise.all([
        getClient(clientId),
        getClientHistory(clientId),
        getClientDebt(clientId),
      ]);
      setClient(c);
      setHistory(h);
      setDebt(d);
    });
  };

  useEffect(() => {
    loadData();
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePayment = () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return;
    startTransition(async () => {
      try {
        await createPayment({
          clientId,
          amount: paymentAmount,
          date: paymentDate,
          note: paymentNote,
        });
        showToast(t("debts.addPayment"));
        setPaymentOpen(false);
        setPaymentAmount("");
        setPaymentNote("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  if (!client || !history) {
    return (
      <div className="py-12 text-center text-gray-500 font-medium">{t("common.loading")}</div>
    );
  }

  type HistoryEntry =
    | { type: "sale"; date: Date; data: HistoryType["sales"][number] }
    | { type: "payment"; date: Date; data: HistoryType["payments"][number] };

  const entries: HistoryEntry[] = [
    ...history.sales.map((s) => ({ type: "sale" as const, date: s.date, data: s })),
    ...history.payments.map((p) => ({ type: "payment" as const, date: p.date, data: p })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-3"
      >
        <ArrowLeft size={18} /> {t("common.cancel")}
      </button>

      <PageHeader
        title={client.name}
        subtitle={client.phone || client.address || undefined}
        action={
          <Button onClick={() => setPaymentOpen(true)} size="md">
            <Plus size={18} /> {t("debts.addPayment")}
          </Button>
        }
      />

      {/* Debt summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="flex flex-col items-center justify-center p-6 text-center md:col-span-3 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-zinc-900 dark:to-zinc-900 border-blue-100 dark:border-zinc-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
            {t("debts.clientProfile")}
          </span>
          <span
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight my-1 ${
              debt > 0
                ? "text-red-600 dark:text-red-400"
                : debt < 0
                ? "text-blue-600 dark:text-blue-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {formatUZS(debt)}{" "}
            <span className="text-sm font-normal text-gray-500">{t("common.sum")}</span>
          </span>
          <span className="text-xs font-semibold text-gray-500">
            {debt > 0 ? t("debts.debtor") : debt < 0 ? t("debts.overpaid") : t("debts.settled")}
          </span>
        </Card>
      </div>

      {/* History section */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
          {t("debts.transactionHistory")}
        </h3>

        {entries.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">{t("common.noData")}</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry, idx) => (
              <Card key={idx} className="p-4">
                {entry.type === "sale" ? (() => {
                  const sale = entry.data as HistoryType["sales"][number];
                  const total = sale.items.reduce((s, i) => s + Number(i.lineTotal), 0);
                  return (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            sale.type === "SALE"
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"
                              : "bg-amber-50 text-amber-600 dark:bg-amber-950/40"
                          }`}
                        >
                          <ShoppingCart size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-900 dark:text-white">
                            {sale.type === "SALE" ? t("sales.saleType") : t("sales.returnType")}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-zinc-400">
                            {formatDateShort(sale.date, language)} · {sale.items.length}{" "}
                            {t("sales.lineItems")}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-extrabold text-base ${
                            sale.type === "SALE" ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {sale.type === "SALE" ? "+" : "−"}
                          {formatUZS(total)}{" "}
                          <span className="text-xs font-normal text-gray-500">{t("common.sum")}</span>
                        </div>
                        {Number(sale.payment) > 0 && (
                          <div className="text-xs text-emerald-600 font-medium">
                            {t("sales.paidAmount")}: {formatUZS(sale.payment)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })() : (() => {
                  const payment = entry.data as HistoryType["payments"][number];
                  return (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-900 dark:text-white">
                            {t("debts.payment")}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-zinc-400">
                            {formatDateShort(payment.date, language)}
                            {payment.note && ` · ${payment.note}`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-extrabold text-base text-emerald-600">
                        −{formatUZS(payment.amount)}{" "}
                        <span className="text-xs font-normal text-gray-500">{t("common.sum")}</span>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Payment Form Modal */}
      <ModalSheet open={paymentOpen} onClose={() => setPaymentOpen(false)} title={t("debts.newPayment")}>
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.amount")}
            type="number"
            step="any"
            min="0"
            placeholder="0"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            autoFocus
          />
          <Input
            label={t("common.date")}
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
          <Input
            label={t("common.notes")}
            placeholder="..."
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handlePayment}
            disabled={!paymentAmount || Number(paymentAmount) <= 0}
            loading={isPending}
          >
            {t("debts.addPayment")}
          </Button>
        </div>
      </ModalSheet>
    </>
  );
}
