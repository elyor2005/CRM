"use client";

import { useState, useEffect, useTransition, useRef } from "react";
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
  Calendar,
  ChevronDown,
  Plus,
  X,
  Check,
} from "lucide-react";
import { formatUZS, formatDateShort, formatDateInput } from "@/lib/format";
import { getDashboardData, type PeriodPreset } from "@/app/actions/dashboard";
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

  // Period Preset for "Итоги за период" (default "TODAY")
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("TODAY");
  const [customFrom, setCustomFrom] = useState(formatDateInput(new Date()));
  const [customTo, setCustomTo] = useState(formatDateInput(new Date()));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // asOfDate for "Текущая позиция"
  const [asOfDate, setAsOfDate] = useState<string>("");
  const [asOfPickerOpen, setAsOfPickerOpen] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = (preset: PeriodPreset, from?: string, to?: string, asOf?: string) => {
    startTransition(async () => {
      const d = await getDashboardData({
        periodPreset: preset,
        dateFrom: preset === "CUSTOM" ? from : undefined,
        dateTo: preset === "CUSTOM" ? to : undefined,
        asOfDate: asOf || undefined,
      });
      setData(d);
    });
  };

  useEffect(() => {
    fetchData(periodPreset, customFrom, customTo, asOfDate);
  }, [periodPreset, asOfDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const getPeriodLabel = () => {
    switch (periodPreset) {
      case "TODAY":
        return t("common.today");
      case "7_DAYS":
        return t("common.days7");
      case "30_DAYS":
        return t("common.days30");
      case "THIS_MONTH":
        return t("common.thisMonth");
      case "CUSTOM":
        if (customFrom && customTo) {
          return `${formatDateShort(customFrom, language)} – ${formatDateShort(customTo, language)}`;
        }
        return t("common.custom");
      default:
        return t("common.today");
    }
  };

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

      {/* ─── Today's Stats (Strictly today-only, unaffected by date controls) ─── */}
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

      {/* ─── Current Financial Position (Live Balance Snapshot, or as of date) ─── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
            {t("dashboard.currentPosition")}
          </h3>

          {/* "+ Дата" Snapshot Date Control */}
          <div className="flex items-center gap-2">
            {!asOfDate ? (
              asOfPickerOpen ? (
                <div className="flex items-center gap-1.5 bg-white dark:bg-[#1A2234] border border-gray-200 dark:border-zinc-800 px-2.5 py-1 rounded-xl shadow-xs animate-in fade-in duration-150">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {language === "ru" ? "На дату:" : language === "uz" ? "Sana:" : "As of:"}
                  </span>
                  <input
                    type="date"
                    defaultValue={formatDateInput(new Date())}
                    onChange={(e) => {
                      if (e.target.value) {
                        setAsOfDate(e.target.value);
                        setAsOfPickerOpen(false);
                      }
                    }}
                    className="bg-transparent text-xs font-semibold text-gray-900 dark:text-white outline-none cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setAsOfPickerOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  id="dashboard-asof-trigger"
                  onClick={() => setAsOfPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#1A2234] hover:bg-gray-50 dark:hover:bg-[#232D42] text-xs font-bold text-gray-700 dark:text-gray-200 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus size={13} className="text-indigo-500" />
                  <span>{language === "ru" ? "Дата" : language === "uz" ? "Sana" : "Date"}</span>
                </button>
              )
            ) : (
              <div className="flex items-center gap-2 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/40 px-3 py-1 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <Calendar size={13} />
                <span>
                  {language === "ru" ? "На дату:" : language === "uz" ? "Sana:" : "As of:"}{" "}
                  {formatDateShort(asOfDate, language)}
                </span>
                <button
                  type="button"
                  onClick={() => setAsOfDate("")}
                  title={language === "ru" ? "Сбросить к текущему" : "Reset to live"}
                  className="hover:bg-indigo-200/50 dark:hover:bg-indigo-800/50 p-0.5 rounded transition-colors cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`grid grid-cols-2 md:grid-cols-4 gap-3.5 ${isPending ? "opacity-75 transition-opacity" : ""}`}>
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

      {/* ─── Bottom Summary Row (Period-Filtered Performance) ─── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
            {t("dashboard.summaryRow")}
          </h3>

          {/* Period Selector Dropdown Trigger & Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              id="dashboard-period-trigger"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#1A2234] hover:bg-gray-50 dark:hover:bg-[#232D42] text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 shadow-xs transition-colors cursor-pointer"
            >
              <Calendar size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>{getPeriodLabel()}</span>
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform duration-200 ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-40 w-64 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#161D2B] p-2 shadow-xl space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setPeriodPreset("TODAY");
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left cursor-pointer ${
                    periodPreset === "TODAY"
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <span>{t("common.today")}</span>
                  {periodPreset === "TODAY" && <Check size={14} />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPeriodPreset("7_DAYS");
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left cursor-pointer ${
                    periodPreset === "7_DAYS"
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <span>{t("common.days7")}</span>
                  {periodPreset === "7_DAYS" && <Check size={14} />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPeriodPreset("30_DAYS");
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left cursor-pointer ${
                    periodPreset === "30_DAYS"
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <span>{t("common.days30")}</span>
                  {periodPreset === "30_DAYS" && <Check size={14} />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPeriodPreset("THIS_MONTH");
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left cursor-pointer ${
                    periodPreset === "THIS_MONTH"
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <span>{t("common.thisMonth")}</span>
                  {periodPreset === "THIS_MONTH" && <Check size={14} />}
                </button>

                {/* Custom Date Range Option */}
                <div className="pt-1 border-t border-gray-100 dark:border-zinc-800">
                  <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {t("common.custom")}
                  </div>
                  <div className="px-3 pb-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 text-[11px] w-6">{t("common.from")}:</span>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="flex-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 text-xs font-medium text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 text-[11px] w-6">{t("common.to")}:</span>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="flex-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 text-xs font-medium text-gray-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodPreset("CUSTOM");
                        fetchData("CUSTOM", customFrom, customTo, asOfDate);
                        setDropdownOpen(false);
                      }}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      {language === "ru" ? "Применить" : language === "uz" ? "Qo'llash" : "Apply"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`grid grid-cols-2 md:grid-cols-4 gap-3.5 ${isPending ? "opacity-75 transition-opacity" : ""}`}>
          <StatCard
            label={t("dashboard.totalSales")}
            value={formatUZS(data.periodSummary.totalSales)}
            icon={<ShoppingCart size={18} />}
            theme="indigo"
            onClick={() => router.push("/sales")}
          />
          <StatCard
            label={t("dashboard.payment")}
            value={formatUZS(data.periodSummary.totalPayments)}
            icon={<Banknote size={18} />}
            theme="emerald"
            onClick={() => router.push("/finance")}
          />
          <StatCard
            label={t("dashboard.totalExpenses")}
            value={formatUZS(data.periodSummary.totalExpenses)}
            icon={<TrendingDown size={18} />}
            theme="rose"
            onClick={() => router.push("/finance")}
          />
          <StatCard
            label={t("dashboard.netProfit")}
            value={formatUZS(data.periodSummary.netProfit)}
            icon={<TrendingUp size={18} />}
            theme={data.periodSummary.netProfit >= 0 ? "emerald" : "rose"}
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
