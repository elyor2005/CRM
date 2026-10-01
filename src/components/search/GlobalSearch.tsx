"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Users,
  Package,
  ShoppingCart,
  Loader2,
  ArrowRight,
  MapPin,
  Phone,
} from "lucide-react";
import { searchGlobal, SearchResults } from "@/app/actions/search";
import { formatUZS } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";

interface GlobalSearchProps {
  isMobileModal?: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function GlobalSearch({
  isMobileModal = false,
  isOpenMobile = false,
  onCloseMobile,
}: GlobalSearchProps) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await searchGlobal(query);
          setResults(res);
          setIsOpen(true);
        } catch (e) {
          console.error("Search error:", e);
        }
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle outside click on desktop
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global keyboard shortcut (Ctrl+K or ⌘K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        if (isMobileModal && onCloseMobile) {
          onCloseMobile();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileModal, onCloseMobile]);

  // Focus input when mobile modal opens
  useEffect(() => {
    if (isMobileModal && isOpenMobile) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isMobileModal, isOpenMobile]);

  const handleSelect = (url: string) => {
    setIsOpen(false);
    setQuery("");
    if (onCloseMobile) onCloseMobile();
    router.push(url);
  };

  const hasResults =
    results &&
    (results.clients.length > 0 ||
      results.products.length > 0 ||
      results.sales.length > 0);

  const placeholderText =
    language === "ru"
      ? "Поиск клиентов, товаров..."
      : language === "uz"
      ? "Mijozlar, tovarlar qidiruvi..."
      : "Search clients, products...";

  const searchInput = (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-zinc-500">
        {isPending ? (
          <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Search size={16} />
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (query.trim().length >= 2) setIsOpen(true);
        }}
        placeholder={placeholderText}
        className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-[#182030] border border-gray-200 dark:border-zinc-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all shadow-xs"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setResults(null);
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );

  const renderDropdownContent = () => {
    if (!isOpen || query.trim().length < 2) return null;

    if (!hasResults && !isPending) {
      return (
        <div className="p-4 text-center text-xs sm:text-sm text-gray-500 dark:text-zinc-400">
          {language === "ru"
            ? "Ничего не найдено"
            : language === "uz"
            ? "Hech narsa topilmadi"
            : "No results found"}
        </div>
      );
    }

    if (!results) return null;

    return (
      <div className="divide-y divide-gray-100 dark:divide-zinc-800/80 max-h-[65vh] overflow-y-auto scrollbar-thin">
        {/* Clients group */}
        {results.clients.length > 0 && (
          <div className="p-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              <Users size={13} />
              <span>
                {language === "ru"
                  ? "Клиенты"
                  : language === "uz"
                  ? "Mijozlar"
                  : "Clients"}
              </span>
            </div>
            <div className="space-y-0.5 mt-1">
              {results.clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(`/debts/${c.id}`)}
                  className="w-full text-left flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {c.name}
                    </div>
                    {(c.phone || c.district) && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={11} /> {c.phone}
                          </span>
                        )}
                        {c.district && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {c.district}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <ArrowRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Products group */}
        {results.products.length > 0 && (
          <div className="p-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              <Package size={13} />
              <span>
                {language === "ru"
                  ? "Товары на складе"
                  : language === "uz"
                  ? "Ombordagi tovarlar"
                  : "Products"}
              </span>
            </div>
            <div className="space-y-0.5 mt-1">
              {results.products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(`/warehouse/${p.id}`)}
                  className="w-full text-left flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                      Остаток: <span className="font-semibold text-gray-700 dark:text-zinc-300">{p.quantity} {p.unit}</span>
                      {p.salePrice && (
                        <span className="ml-2">
                          · {formatUZS(p.salePrice)} UZS
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sales group */}
        {results.sales.length > 0 && (
          <div className="p-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              <ShoppingCart size={13} />
              <span>
                {language === "ru"
                  ? "Продажи"
                  : language === "uz"
                  ? "Sotuvlar"
                  : "Sales"}
              </span>
            </div>
            <div className="space-y-0.5 mt-1">
              {results.sales.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect("/sales")}
                  className="w-full text-left flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {s.client.name}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 truncate">
                      {s.date} · {s.itemSummary} · <span className="font-semibold text-gray-700 dark:text-zinc-300">{formatUZS(s.totalAmount)} UZS</span>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Mobile Modal View
  if (isMobileModal) {
    if (!isOpenMobile) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col p-4">
        <div className="bg-white dark:bg-[#131823] border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95">
          <div className="p-3 border-b border-gray-100 dark:border-zinc-800/80 flex items-center gap-2">
            <div className="flex-1">{searchInput}</div>
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderDropdownContent()}
          </div>
        </div>
      </div>
    );
  }

  // Desktop Sidebar Pinned View
  return (
    <div ref={containerRef} className="relative w-full">
      {searchInput}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#131823] border border-gray-200/90 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden w-[340px] animate-in fade-in slide-in-from-top-2">
          {renderDropdownContent()}
        </div>
      )}
    </div>
  );
}
