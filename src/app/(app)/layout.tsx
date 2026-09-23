"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShoppingCart,
  Users,
  Wallet,
  Package,
  BarChart3,
  LogOut,
  Building2,
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

  const tabs = [
    { href: "/sales", labelKey: "nav.sales", icon: ShoppingCart },
    { href: "/debts", labelKey: "nav.debts", icon: Users },
    { href: "/finance", labelKey: "nav.finance", icon: Wallet },
    { href: "/warehouse", labelKey: "nav.warehouse", icon: Package },
    { href: "/report", labelKey: "nav.report", icon: BarChart3 },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-zinc-950">
        {/* ─── Desktop Sidebar (md:flex) ─── */}
        <aside className="hidden md:flex flex-col w-64 border-r border-gray-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sticky top-0 h-screen shrink-0 justify-between">
          <div className="flex flex-col gap-6">
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <Building2 size={22} />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  {t("app.title")}
                </h1>
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  CRM Cloud
                </span>
              </div>
            </div>

            {/* Navigation Menu Links */}
            <nav className="flex flex-col gap-1">
              {tabs.map((tab) => {
                const isActive = pathname.startsWith(tab.href);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                    <span>{t(tab.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Controls */}
          <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                {t("common.language")}
              </span>
              <LanguageSwitcher />
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <LogOut size={18} />
              <span>{t("app.logout")}</span>
            </button>
          </div>
        </aside>

        {/* ─── Mobile Header (< md) ─── */}
        <header className="md:hidden sticky top-0 z-40 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-b border-gray-200/80 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
            {t("app.title")}
          </span>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              title={t("app.logout")}
              className="p-1.5 text-gray-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* ─── Main Content Canvas ─── */}
        <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
          {children}
        </main>

        {/* ─── Mobile Bottom Tab Navigation (< md) ─── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-gray-200/80 dark:border-zinc-800 px-2 py-2 flex justify-around items-center">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
                <span className="text-[10px] tracking-tight">{t(tab.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </ToastProvider>
  );
}
