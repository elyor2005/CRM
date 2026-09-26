"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Search, Plus, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { formatUZS, formatDateShort } from "@/lib/format";
import { getClientsWithDebt } from "@/app/actions/clients";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Table, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/app/actions/clients";
import { formatDateInput } from "@/lib/format";
import { exportToExcel } from "@/lib/exportExcel";

type ClientWithDebt = Awaited<ReturnType<typeof getClientsWithDebt>>[number];

type SortField = "name" | "district" | "totalSalesValue" | "totalPaid" | "debt" | "lastSaleDate" | "status";
type SortDir = "asc" | "desc";

export default function DebtsPage() {
  const { language, t } = useLanguage();
  const [clients, setClients] = useState<ClientWithDebt[]>([]);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showToast } = useToast();

  // Sort state (Task 3b)
  const [sortField, setSortField] = useState<SortField>("debt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // New client form state (Task 3c / Task 6)
  const [newClientSheet, setNewClientSheet] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDistrict, setFormDistrict] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formVisitFrequency, setFormVisitFrequency] = useState("");
  const [formOpeningDebt, setFormOpeningDebt] = useState("");

  const loadData = () => {
    startTransition(async () => {
      const data = await getClientsWithDebt();
      setClients(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.district && c.district.toLowerCase().includes(search.toLowerCase()))
  );

  // Sorting (Task 3b)
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "name":
        return dir * a.name.localeCompare(b.name);
      case "district":
        return dir * ((a.district || "").localeCompare(b.district || ""));
      case "totalSalesValue":
        return dir * (a.totalSalesValue - b.totalSalesValue);
      case "totalPaid":
        return dir * (a.totalPaid - b.totalPaid);
      case "debt":
        return dir * (a.debt - b.debt);
      case "lastSaleDate":
        return dir * ((a.lastSaleDate?.getTime() || 0) - (b.lastSaleDate?.getTime() || 0));
      case "status": {
        const statusA = a.debt > 0 ? 2 : a.debt < 0 ? 0 : 1;
        const statusB = b.debt > 0 ? 2 : b.debt < 0 ? 0 : 1;
        return dir * (statusA - statusB);
      }
      default:
        return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "district" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp size={12} className="text-indigo-600 dark:text-indigo-400" />
      : <ArrowDown size={12} className="text-indigo-600 dark:text-indigo-400" />;
  };

  const totalDebt = clients.reduce((sum, c) => sum + (c.debt > 0 ? c.debt : 0), 0);

  const getDebtBadge = (debt: number) => {
    if (debt > 0) return { label: t("debts.debtor"), variant: "debt" as const };
    if (debt < 0) return { label: t("debts.overpaid"), variant: "overpaid" as const };
    return { label: t("debts.settled"), variant: "settled" as const };
  };

  const handleAddClient = () => {
    if (!formName.trim()) return;
    startTransition(async () => {
      try {
        await createClient({
          name: formName.trim(),
          district: formDistrict.trim(),
          phone: formPhone.trim(),
          address: formAddress.trim(),
          visitFrequency: formVisitFrequency,
          openingDebt: formOpeningDebt,
        });
        showToast(t("common.add"));
        setNewClientSheet(false);
        setFormName("");
        setFormDistrict("");
        setFormPhone("");
        setFormAddress("");
        setFormVisitFrequency("");
        setFormOpeningDebt("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  const sortableHeader = (label: string, field: SortField) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer w-full"
    >
      <span>{label}</span>
      <SortIcon field={field} />
    </button>
  );

  const handleExportExcel = () => {
    const headers = [
      t("common.name"),
      t("common.district"),
      `${t("debts.totalSales")} (${t("common.sum")})`,
      `${t("debts.totalPaid")} (${t("common.sum")})`,
      `${t("debts.currentDebt")} (${t("common.sum")})`,
      t("debts.lastSale"),
      t("common.status"),
    ];

    const rows = sorted.map((client) => [
      client.name,
      client.district || "—",
      client.totalSalesValue,
      client.totalPaid,
      client.debt,
      client.lastSaleDate ? formatDateShort(client.lastSaleDate, language) : "—",
      client.debt > 0 ? t("debts.debtor") : client.debt < 0 ? t("debts.overpaid") : t("debts.settled"),
    ]);

    const summaryRows = [
      [],
      [t("common.total"), "", "", "", totalDebt, "", ""],
    ];

    exportToExcel(`Клиенты_${formatDateInput(new Date())}`, [
      {
        name: "Клиенты",
        data: [headers, ...rows, ...summaryRows],
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("clients.title")}
        subtitle={
          totalDebt > 0 ? (
            <span>
              {t("debts.totalDebt")}:{" "}
              <strong className="text-orange-600 dark:text-orange-400 font-extrabold tabular-nums">
                {formatUZS(totalDebt)} {t("common.sum")}
              </strong>
            </span>
          ) : undefined
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={handleExportExcel}
              disabled={sorted.length === 0}
              className="min-h-[44px] gap-2 px-3.5 bg-white dark:bg-[#131823] border-gray-200/80 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 shadow-xs"
            >
              <Download size={16} className="text-gray-500 dark:text-zinc-400" />
              <span className="text-xs sm:text-sm font-bold">{t("common.exportExcel")}</span>
            </Button>
            <Button onClick={() => setNewClientSheet(true)} size="md">
              <Plus size={18} /> {t("clients.addClient")}
            </Button>
          </div>
        }
      />

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1E2638] border border-gray-200/80 dark:border-zinc-800 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/80 text-gray-900 dark:text-white"
          placeholder={`${t("clients.title")}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Client List */}
      {loading ? (
        <div className="bg-white dark:bg-[#131823] rounded-2xl border border-gray-200/80 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title={t("common.noData")}
        />
      ) : (
        <Table
          headers={[
            sortableHeader(t("common.name"), "name"),
            sortableHeader(t("common.district"), "district"),
            sortableHeader(t("debts.totalSales"), "totalSalesValue"),
            sortableHeader(t("debts.totalPaid"), "totalPaid"),
            sortableHeader(t("debts.currentDebt"), "debt"),
            sortableHeader(t("debts.lastSale"), "lastSaleDate"),
            sortableHeader(t("common.status"), "status"),
          ]}
          alignments={["left", "left", "right", "right", "right", "right", "center"]}
        >
          {sorted.map((client) => {
            const badge = getDebtBadge(client.debt);
            return (
              <TableRow
                key={client.id}
                onClick={() => router.push(`/debts/${client.id}`)}
              >
                <td className="p-3.5 sm:p-4">
                  <div className="font-extrabold text-gray-900 dark:text-white">{client.name}</div>
                  {client.last30DaysSalesSum > 0 && (
                    <div className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                      30d: {formatUZS(client.last30DaysSalesSum)}
                    </div>
                  )}
                </td>
                <td className="p-3.5 sm:p-4 text-gray-600 dark:text-zinc-400 font-medium">
                  {client.district || "—"}
                </td>
                <td className="p-3.5 sm:p-4 text-right whitespace-nowrap text-gray-700 dark:text-zinc-300 font-semibold tabular-nums">
                  {formatUZS(client.totalSalesValue)}
                </td>
                <td className="p-3.5 sm:p-4 text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                  {formatUZS(client.totalPaid)}
                </td>
                <td
                  className={`p-3.5 sm:p-4 text-right whitespace-nowrap font-extrabold tabular-nums ${
                    client.debt > 0
                      ? "text-orange-600 dark:text-orange-400"
                      : client.debt < 0
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatUZS(client.debt)}
                </td>
                <td className="p-3.5 sm:p-4 text-right whitespace-nowrap text-xs text-gray-500 dark:text-zinc-400 font-medium">
                  {client.lastSaleDate ? formatDateShort(client.lastSaleDate, language) : "—"}
                </td>
                <td className="p-3.5 sm:p-4 text-center">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </td>
              </TableRow>
            );
          })}
        </Table>
      )}

      {/* New Client ModalSheet (Task Group 6 — full client creation) */}
      <ModalSheet
        open={newClientSheet}
        onClose={() => setNewClientSheet(false)}
        title={t("clients.addClient")}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.name")}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="ООО Азия Трейд"
            autoFocus
          />
          <Input
            label={t("common.district")}
            value={formDistrict}
            onChange={(e) => setFormDistrict(e.target.value)}
            placeholder="Чиланзар"
          />
          <Input
            label={t("common.phone")}
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
          />
          <Input
            label={t("common.address")}
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            placeholder="ул. Амира Темура 1"
          />
          <Input
            label={t("common.visitFrequency")}
            type="number"
            min="1"
            value={formVisitFrequency}
            onChange={(e) => setFormVisitFrequency(e.target.value)}
            placeholder="7"
          />
          <Input
            label={t("common.openingDebt")}
            type="number"
            min="0"
            value={formOpeningDebt}
            onChange={(e) => setFormOpeningDebt(e.target.value)}
            placeholder="0"
          />
          <Button onClick={handleAddClient} loading={isPending} size="lg">
            {t("common.save")}
          </Button>
        </div>
      </ModalSheet>
    </div>
  );
}
