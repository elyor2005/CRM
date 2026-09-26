"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Wallet,
  Package,
  BarChart3,
  ClipboardList,
  LogOut,
  Building2,
  CreditCard,
  Settings,
} from "lucide-react";
import { ToastProvider } from "@/components/ui/Toast";
import { useLanguage } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const mainTabs = [
    { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
    { href: "/sales", labelKey: "nav.sales", icon: ShoppingCart },
    { href: "/debts", labelKey: "nav.clients", icon: Users },
    { href: "/finance", labelKey: "nav.finance", icon: Wallet },
    { href: "/warehouse", labelKey: "nav.warehouse", icon: Package },
    { href: "/report", labelKey: "nav.report", icon: BarChart3 },
    { href: "/audit", labelKey: "nav.audit", icon: ClipboardList },
  ];

  const bottomTabs = [
    { href: "/liabilities", labelKey: "nav.liabilities", icon: CreditCard },
    { href: "/settings", labelKey: "nav.settings", icon: Settings },
  ];

  const tabs = [...mainTabs, ...bottomTabs];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F4F6F8] dark:bg-[#0B0E14] text-gray-900 dark:text-slate-100">
        {/* ─── Desktop Persistent Fixed Sidebar (md:flex) ─── */}
        <aside className="hidden md:flex flex-col fixed top-0 bottom-0 left-0 w-64 border-r border-gray-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#131823] p-5 justify-between z-30 shadow-xs overflow-y-auto">
          <div className="flex flex-col gap-6">
            {/* Brand Logo & App Header */}
            <div className="flex items-center gap-3 px-2 pt-1">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 dark:bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
                <Building2 size={22} />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
                  {t("app.title")}
                </h1>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  CRM Cloud
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1.5" aria-label="Main Navigation">
              {mainTabs.map((tab) => {
                const isActive = pathname.startsWith(tab.href);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                        : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-[#1A202C] hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                    <span>{t(tab.labelKey)}</span>
                  </Link>
                );
              })}

              {/* Bottom nav items (below audit, above footer) */}
              <div className="border-t border-gray-100 dark:border-zinc-800/60 mt-2 pt-2">
                {bottomTabs.map((tab) => {
                  const isActive = pathname.startsWith(tab.href);
                  const Icon = tab.icon;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                          : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-[#1A202C] hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                      <span>{t(tab.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800/80">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                {t("common.language")}
              </span>
              <LanguageSwitcher />
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut size={18} />
              <span>{t("app.logout")}</span>
            </button>
          </div>
        </aside>

        {/* ─── Content Wrapper (Offset for Desktop Sidebar) ─── */}
        <div className="md:pl-64 flex flex-col min-h-screen">
          {/* Mobile Top Header (< md) */}
          <header className="md:hidden sticky top-0 z-40 bg-white/90 dark:bg-[#131823]/90 backdrop-blur-md border-b border-gray-200/80 dark:border-zinc-800/80 px-4 py-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Building2 size={18} />
              </div>
              <span className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                {t("app.title")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <button
                onClick={handleLogout}
                title={t("app.logout")}
                className="p-2 text-gray-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>

          {/* Main Content Canvas (Max-width capped on Desktop) */}
          <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-8">
            {children}
          </main>
        </div>

        {/* ─── Mobile Bottom Tab Navigation Bar (< md) ─── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#131823]/95 backdrop-blur-md border-t border-gray-200/80 dark:border-zinc-800/80 px-2 pt-2 pb-[calc(0.5rem+var(--sai-bottom))] flex justify-around items-center shadow-lg">
          {mainTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] justify-center ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400 font-bold"
                    : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.3 : 1.7} />
                <span className="text-[10px] tracking-tight">{t(tab.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </ToastProvider>
  );
}
