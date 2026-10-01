"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Edit, Trash2 } from "lucide-react";
import { formatUZS, formatDateShort, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/components/ui/Toast";
import { getClient, getClientHistory, getClientDetailedStats, updateClient, deleteClient } from "@/app/actions/clients";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableRowSkeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { SaleDetailModal } from "@/components/sales/SaleDetailModal";
import { ReceivePaymentModal } from "@/components/payments/ReceivePaymentModal";

type ClientType = NonNullable<Awaited<ReturnType<typeof getClient>>>;
type HistoryType = Awaited<ReturnType<typeof getClientHistory>>;
type StatsType = Awaited<ReturnType<typeof getClientDetailedStats>>;

export default function ClientDetailPage() {
  const { language, t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const [client, setClient] = useState<ClientType | null>(null);
  const [history, setHistory] = useState<HistoryType | null>(null);
  const [stats, setStats] = useState<StatsType | null>(null);
  const [selectedSale, setSelectedSale] = useState<HistoryType["sales"][number] | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  // Edit client state
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editVisitFrequency, setEditVisitFrequency] = useState("");

  const loadData = () => {
    startTransition(async () => {
      const [c, h, s] = await Promise.all([
        getClient(clientId),
        getClientHistory(clientId),
        getClientDetailedStats(clientId),
      ]);
      setClient(c);
      setHistory(h);
      setStats(s);
    });
  };

  useEffect(() => {
    loadData();
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEditClient = () => {
    if (!client) return;
    setEditName(client.name);
    setEditDistrict(client.district || "");
    setEditPhone(client.phone || "");
    setEditAddress(client.address || "");
    setEditVisitFrequency(client.visitFrequency ? String(client.visitFrequency) : "");
    setEditClientOpen(true);
  };

  const handleUpdateClient = () => {
    if (!editName.trim()) return;
    startTransition(async () => {
      try {
        await updateClient(clientId, {
          name: editName.trim(),
          district: editDistrict.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim(),
          visitFrequency: editVisitFrequency,
        });
        showToast("Данные клиента сохранены");
        setEditClientOpen(false);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const handleDeleteClient = () => {
    if (!confirm(`Вы уверены, что хотите удалить клиента "${client?.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteClient(clientId);
        showToast("Клиент удалён");
        router.push("/debts");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка удаления", "error");
      }
    });
  };

  if (!client || !history || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
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
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
      >
        <ArrowLeft size={18} /> {t("common.cancel")}
      </button>

      <PageHeader
        title={client.name}
        subtitle={client.phone || client.address || undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={startEditClient}
              className="gap-1.5"
            >
              <Edit size={16} /> Редактировать
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={handleDeleteClient}
              className="gap-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border-rose-200 dark:border-rose-900/50"
            >
              <Trash2 size={16} /> Удалить
            </Button>
            <Button onClick={() => setPaymentOpen(true)} size="md" className="gap-1.5">
              <Plus size={18} /> {t("debts.addPayment")}
            </Button>
          </div>
        }
      />

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="p-4 text-center">
          <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">{t("debts.totalSales")}</div>
          <div className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white tabular-nums">{formatUZS(stats.totalSalesValue)}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">{t("debts.totalPaid")}</div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatUZS(stats.totalPaid)}</div>
        </Card>
        <Card className="p-4 text-center col-span-2">
          <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">{t("debts.currentDebt")}</div>
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${stats.currentDebt > 0 ? "text-orange-600 dark:text-orange-400" : stats.currentDebt < 0 ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {formatUZS(stats.currentDebt)} <span className="text-xs font-bold text-gray-500">{t("common.sum")}</span>
          </div>
        </Card>
      </div>

      {/* Debt Aging Buckets */}
      {stats.currentDebt > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
            {t("debts.debtAging")}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t("debts.days0to7"), value: stats.debtAging.days0to7, color: "text-amber-600 dark:text-amber-400" },
              { label: t("debts.days8to30"), value: stats.debtAging.days8to30, color: "text-orange-600 dark:text-orange-400" },
              { label: t("debts.days31to60"), value: stats.debtAging.days31to60, color: "text-rose-500 dark:text-rose-400" },
              { label: t("debts.days60plus"), value: stats.debtAging.days60plus, color: "text-rose-700 dark:text-rose-500" },
            ].map((bucket) => (
              <Card key={bucket.label} className="p-3 text-center">
                <div className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">{bucket.label}</div>
                <div className={`text-sm font-extrabold tabular-nums ${bucket.value > 0 ? bucket.color : "text-gray-300 dark:text-zinc-600"}`}>
                  {formatUZS(bucket.value)}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Quick Counts */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">{t("debts.salesCount")}</div>
          <div className="text-base font-extrabold text-gray-900 dark:text-white tabular-nums">{stats.salesCount}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">{t("debts.returnsCount")}</div>
          <div className="text-base font-extrabold text-gray-900 dark:text-white tabular-nums">{stats.returnsCount}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">{t("debts.paymentsCount")}</div>
          <div className="text-base font-extrabold text-gray-900 dark:text-white tabular-nums">{stats.paymentsCount}</div>
        </Card>
      </div>

      {/* Transaction History Table */}
      <section className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
          {t("debts.transactionHistory")}
        </h3>

        {entries.length === 0 ? (
          <EmptyState title={t("common.noData")} />
        ) : (
          <Table
            headers={[t("common.date"), t("common.type"), t("common.description"), t("common.amount")]}
            alignments={["left", "left", "left", "right"]}
          >
            {entries.map((entry, idx) => {
              if (entry.type === "sale") {
                const sale = entry.data as HistoryType["sales"][number];
                const total = sale.items.reduce((s, i) => s + Number(i.lineTotal), 0);
                return (
                  <TableRow
                    key={`sale-${idx}`}
                    className="cursor-pointer hover:bg-gray-50/70 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => setSelectedSale(sale)}
                  >
                    <td className="p-3.5 whitespace-nowrap text-gray-700 dark:text-zinc-300 font-medium">
                      {formatDateShort(sale.date, language)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <Badge variant={sale.type === "SALE" ? "sale" : "return"}>
                        {sale.type === "SALE" ? t("sales.saleType") : t("sales.returnType")}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-gray-900 dark:text-white font-medium">
                      {sale.items.length} {t("sales.lineItems")}
                      {Number(sale.payment) > 0 && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-2 tabular-nums">
                          {t("sales.paidAmount")}: {formatUZS(sale.payment)}
                        </span>
                      )}
                    </td>
                    <td className={`p-3.5 text-right whitespace-nowrap font-extrabold tabular-nums ${sale.type === "SALE" ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {sale.type === "SALE" ? "+" : "−"}{formatUZS(total)}
                    </td>
                  </TableRow>
                );
              } else {
                const payment = entry.data as HistoryType["payments"][number];
                return (
                  <TableRow key={`pay-${idx}`}>
                    <td className="p-3.5 whitespace-nowrap text-gray-700 dark:text-zinc-300 font-medium">
                      {formatDateShort(payment.date, language)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <Badge variant="settled">{t("debts.payment")}</Badge>
                    </td>
                    <td className="p-3.5 text-gray-900 dark:text-white font-medium">
                      {t(`paymentMethods.${payment.method}`)}
                      {payment.note && <span className="text-xs text-gray-500 dark:text-zinc-400 ml-2">{payment.note}</span>}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      −{formatUZS(payment.amount)}
                    </td>
                  </TableRow>
                );
              }
            })}
          </Table>
        )}
      </section>

      {/* Payment Form Modal */}
      <ReceivePaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        preselectedClientId={clientId}
        onSuccess={loadData}
      />

      {/* Sale Detail Modal */}
      <SaleDetailModal
        sale={selectedSale && client ? { ...selectedSale, client: { id: client.id, name: client.name } } : null}
        open={!!selectedSale}
        onClose={() => setSelectedSale(null)}
      />

      {/* Edit Client Modal */}
      <ModalSheet
        open={editClientOpen}
        onClose={() => setEditClientOpen(false)}
        title="Редактировать клиента"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.name")}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Имя клиента"
            autoFocus
          />
          <Input
            label={t("common.district")}
            value={editDistrict}
            onChange={(e) => setEditDistrict(e.target.value)}
            placeholder="Район"
          />
          <Input
            label={t("common.phone")}
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
          />
          <Input
            label={t("common.address")}
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
            placeholder="Адрес"
          />
          <Input
            label={t("common.visitFrequency")}
            type="number"
            min="1"
            value={editVisitFrequency}
            onChange={(e) => setEditVisitFrequency(e.target.value)}
            placeholder="7"
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleUpdateClient}
            disabled={!editName.trim()}
            loading={isPending}
          >
            {t("common.save")}
          </Button>
        </div>
      </ModalSheet>
    </div>
  );
}
