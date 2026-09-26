"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  Users,
  ArrowRight,
  DollarSign,
  CreditCard,
  Clock,
  Banknote,
} from "lucide-react";
import { formatUZS, formatDateShort } from "@/lib/format";
import { getDashboardData } from "@/app/actions/dashboard";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { CardSkeleton } from "@/components/ui/Skeleton";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export default function DashboardPage() {
  const { language, t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const d = await getDashboardData();
      setData(d);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) {
    return (
      <>
        <PageHeader title={t("dashboard.title")} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} />

      {/* ─── Today's Stats ─── */}
      <section className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
          {t("dashboard.todayStats")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <StatCard
            label={t("dashboard.salesAmount")}
            value={formatUZS(data.today.sales)}
            icon={<ShoppingCart size={18} />}
            theme="indigo"
            onClick={() => router.push("/sales")}
          />
          <StatCard
            label={t("dashboard.cashReceived")}
            value={formatUZS(data.today.cashReceived)}
            icon={<Wallet size={18} />}
            theme="emerald"
            onClick={() => router.push("/finance")}
          />
          <StatCard
            label={t("dashboard.newDebt")}
            value={formatUZS(data.today.newDebt)}
            icon={<Users size={18} />}
            theme="orange"
            onClick={() => router.push("/debts")}
          />
          <StatCard
            label={t("dashboard.expenses")}
            value={formatUZS(data.today.expenses)}
            icon={<TrendingDown size={18} />}
            theme="rose"
            onClick={() => router.push("/finance")}
          />
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="border-t border-gray-200/60 dark:border-zinc-800/40" />

      {/* ─── Current Financial Position ─── */}
      <section className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
          {t("dashboard.currentPosition")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <StatCard
            label={t("dashboard.totalReceivables")}
            value={formatUZS(data.position.totalReceivables)}
            icon={<Users size={18} />}
            theme="orange"
            onClick={() => router.push("/debts")}
          />
          <StatCard
            label={t("dashboard.warehouseValue")}
            value={formatUZS(data.position.finishedGoodsSaleValue)}
            icon={<Package size={18} />}
            theme="indigo"
            onClick={() => router.push("/warehouse")}
          />
          <StatCard
            label={t("dashboard.liabilitiesTotal")}
            value={formatUZS(data.position.liabilitiesTotal)}
            icon={<CreditCard size={18} />}
            theme="rose"
            onClick={() => router.push("/liabilities")}
          />
          <StatCard
            label={t("dashboard.cashBalance")}
            value={formatUZS(data.position.cashBalance)}
            icon={<Wallet size={18} />}
            theme="emerald"
            onClick={() => router.push("/finance")}
          />
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="border-t border-gray-200/60 dark:border-zinc-800/40" />

      {/* ─── Bottom Summary Row ─── */}
      <section className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
          {t("dashboard.summaryRow")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <StatCard
            label={t("dashboard.totalSales")}
            value={formatUZS(data.position.totalSales)}
            icon={<ShoppingCart size={18} />}
            theme="indigo"
          />
          <StatCard
            label={t("dashboard.payment")}
            value={formatUZS(data.today.totalPayments)}
            icon={<Banknote size={18} />}
            theme="emerald"
            onClick={() => router.push("/debts")}
          />
          <StatCard
            label={t("dashboard.totalExpenses")}
            value={formatUZS(data.position.totalExpenses)}
            icon={<TrendingDown size={18} />}
            theme="rose"
          />
          <StatCard
            label={t("dashboard.netProfit")}
            value={formatUZS(data.position.netProfit)}
            icon={<TrendingUp size={18} />}
            theme={data.position.netProfit >= 0 ? "emerald" : "rose"}
            onClick={() => router.push("/report")}
          />
        </div>
      </section>

      {/* ─── Alerts ─── */}
      {(data.alerts.lowStockItems.length > 0 || data.alerts.debtClients.length > 0 || data.alerts.overdueVisitClients.length > 0) && (
        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
            {t("dashboard.alerts")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.alerts.lowStockItems.length > 0 && (
              <Card className="p-0 overflow-hidden border-amber-200/80 dark:border-amber-900/40">
                <div className="flex items-center justify-between p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={17} className="text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-bold text-amber-900 dark:text-amber-300">
                      {t("dashboard.lowStock")} ({data.alerts.lowStockItems.length})
                    </span>
                  </div>
                  <button
                    onClick={() => router.push("/warehouse")}
                    className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <span>{t("common.all")}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                  {data.alerts.lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-950/10 transition-colors"
                      onClick={() => router.push(`/warehouse/${item.id}`)}
                    >
                      <span className="font-semibold text-gray-900 dark:text-white">{item.name}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">
                        {item.quantity} / {item.minStock} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {data.alerts.debtClients.length > 0 && (
              <Card className="p-0 overflow-hidden border-orange-200/80 dark:border-orange-900/40">
                <div className="flex items-center justify-between p-3.5 bg-orange-50/80 dark:bg-orange-950/30 border-b border-orange-200/60 dark:border-orange-900/40">
                  <div className="flex items-center gap-2">
                    <DollarSign size={17} className="text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-bold text-orange-900 dark:text-orange-300">
                      {t("dashboard.outstandingDebts")} ({data.alerts.debtClients.length})
                    </span>
                  </div>
                  <button
                    onClick={() => router.push("/debts")}
                    className="text-xs font-bold text-orange-700 dark:text-orange-400 hover:underline flex items-center gap-1"
                  >
                    <span>{t("common.all")}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                  {data.alerts.debtClients.slice(0, 5).map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition-colors"
                      onClick={() => router.push(`/debts/${client.id}`)}
                    >
                      <span className="font-semibold text-gray-900 dark:text-white">{client.name}</span>
                      <span className="text-orange-600 dark:text-orange-400 font-bold tabular-nums">{formatUZS(client.debt)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Overdue Visit Clients (Task 7) */}
            {data.alerts.overdueVisitClients.length > 0 && (
              <Card className="p-0 overflow-hidden border-violet-200/80 dark:border-violet-900/40">
                <div className="flex items-center justify-between p-3.5 bg-violet-50/80 dark:bg-violet-950/30 border-b border-violet-200/60 dark:border-violet-900/40">
                  <div className="flex items-center gap-2">
                    <Clock size={17} className="text-violet-600 dark:text-violet-400" />
                    <span className="text-sm font-bold text-violet-900 dark:text-violet-300">
                      {t("dashboard.overdueVisits")} ({data.alerts.overdueVisitClients.length})
                    </span>
                  </div>
                  <button
                    onClick={() => router.push("/debts")}
                    className="text-xs font-bold text-violet-700 dark:text-violet-400 hover:underline flex items-center gap-1"
                  >
                    <span>{t("common.all")}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                  {data.alerts.overdueVisitClients.slice(0, 5).map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-violet-50/40 dark:hover:bg-violet-950/10 transition-colors"
                      onClick={() => router.push(`/debts/${client.id}`)}
                    >
                      <span className="font-semibold text-gray-900 dark:text-white">{client.name}</span>
                      <span className="text-violet-600 dark:text-violet-400 font-bold tabular-nums">
                        +{client.daysOverdue} {t("dashboard.daysOverdue")}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* ─── Recent Activity ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Sales */}
        {data.recent.sales.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                {t("dashboard.recentSales")}
              </h3>
              <button
                onClick={() => router.push("/sales")}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>{t("common.all")}</span>
                <ArrowRight size={14} />
              </button>
            </div>
            <Card className="p-0 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800/60">
              {data.recent.sales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3.5 text-sm hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{sale.clientName}</div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400">{formatDateShort(sale.date, language)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-gray-900 dark:text-white tabular-nums">{formatUZS(sale.total)}</div>
                    {sale.payment > 0 && (
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {t("sales.paidAmount")}: {formatUZS(sale.payment)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Recent Payments */}
        {data.recent.payments.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                {t("dashboard.recentPayments")}
              </h3>
              <button
                onClick={() => router.push("/debts")}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>{t("common.all")}</span>
                <ArrowRight size={14} />
              </button>
            </div>
            <Card className="p-0 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800/60">
              {data.recent.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3.5 text-sm hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{p.clientName}</div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400">
                      {formatDateShort(p.date, language)}
                      {p.method && ` · ${t(`paymentMethods.${p.method}`)}`}
                    </div>
                  </div>
                  <div className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatUZS(p.amount)}</div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  theme,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  theme: "indigo" | "emerald" | "orange" | "rose";
  onClick?: () => void;
}) {
  const themeClasses = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 border-orange-100 dark:border-orange-900/30",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-100 dark:border-rose-900/30",
  };

  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      className="flex flex-col justify-between gap-3 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 tracking-tight leading-tight">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-xs ${themeClasses[theme]}`}>
          {icon}
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums tracking-tight">
        {value}
      </div>
    </Card>
  );
}
