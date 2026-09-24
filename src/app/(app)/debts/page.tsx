"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Search } from "lucide-react";
import { formatUZS, formatDateShort } from "@/lib/format";
import { getClientsWithDebt } from "@/app/actions/clients";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Table, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableRowSkeleton } from "@/components/ui/Skeleton";

type ClientWithDebt = Awaited<ReturnType<typeof getClientsWithDebt>>[number];

export default function DebtsPage() {
  const { language, t } = useLanguage();
  const [clients, setClients] = useState<ClientWithDebt[]>([]);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const data = await getClientsWithDebt();
      setClients(data);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalDebt = clients.reduce((sum, c) => sum + (c.debt > 0 ? c.debt : 0), 0);

  const getDebtBadge = (debt: number) => {
    if (debt > 0) return { label: t("debts.debtor"), variant: "debt" as const };
    if (debt < 0) return { label: t("debts.overpaid"), variant: "overpaid" as const };
    return { label: t("debts.settled"), variant: "settled" as const };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("debts.title")}
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
      />

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1E2638] border border-gray-200/80 dark:border-zinc-800 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/80 text-gray-900 dark:text-white"
          placeholder={`${t("debts.title")}...`}
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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title={t("common.noData")}
        />
      ) : (
        <Table
          headers={[
            t("common.name"),
            t("debts.totalSales"),
            t("debts.totalPaid"),
            t("debts.currentDebt"),
            t("debts.lastSale"),
            t("common.status"),
          ]}
          alignments={["left", "right", "right", "right", "right", "center"]}
        >
          {filtered.map((client) => {
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
    </div>
  );
}
