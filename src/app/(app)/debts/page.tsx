"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Search } from "lucide-react";
import { formatUZS, formatDateShort } from "@/lib/format";
import { getClientsWithDebt } from "@/app/actions/clients";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type ClientWithDebt = Awaited<ReturnType<typeof getClientsWithDebt>>[number];

export default function DebtsPage() {
  const { language, t } = useLanguage();
  const [clients, setClients] = useState<ClientWithDebt[]>([]);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const data = await getClientsWithDebt();
      setClients(data);
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
    <>
      <PageHeader
        title={t("debts.title")}
        subtitle={
          totalDebt > 0 ? (
            <span>
              {t("debts.totalDebt")}:{" "}
              <strong className="text-red-600 dark:text-red-400">
                {formatUZS(totalDebt)} {t("common.sum")}
              </strong>
            </span>
          ) : undefined
        }
      />

      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-xl outline-none text-base transition-all focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
          placeholder={`${t("debts.title")}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Client List Grid */}
      {isPending && clients.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-zinc-400 font-medium">
          {t("common.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 mb-3">
            <Users size={28} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("common.noData")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            {search ? t("common.search") : t("debts.title")}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => {
            const badge = getDebtBadge(client.debt);
            return (
              <Card
                key={client.id}
                hoverable
                onClick={() => router.push(`/debts/${client.id}`)}
                className="flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-base text-gray-900 dark:text-white truncate">
                      {client.name}
                    </span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    {client.lastSaleDate ? (
                      <>{t("debts.lastSale")}: {formatDateShort(client.lastSaleDate, language)}</>
                    ) : (
                      t("common.noData")
                    )}
                    {client.last30DaysSalesSum > 0 && (
                      <> · 30d: {formatUZS(client.last30DaysSalesSum)}</>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">
                    {t("debts.clientProfile")}
                  </span>
                  <span
                    className={`text-lg font-extrabold tracking-tight ${
                      client.debt > 0
                        ? "text-red-600 dark:text-red-400"
                        : client.debt < 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {formatUZS(client.debt)}{" "}
                    <span className="text-xs font-normal text-gray-500">{t("common.sum")}</span>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
