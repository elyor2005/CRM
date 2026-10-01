"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatDateInput, formatDateShort } from "@/lib/format";
import { SegmentedControl } from "./SegmentedControl";

export type DatePresetKey =
  | "TODAY"
  | "7D"
  | "WEEK"
  | "7_DAYS"
  | "30D"
  | "30_DAYS"
  | "MONTH"
  | "THIS_MONTH"
  | "ALL"
  | "CUSTOM";

/**
 * Standard date range calculation for preset periods.
 */
export function calculateDateRange(
  preset: string,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const now = new Date();
  const today = formatDateInput(now);

  switch (preset) {
    case "TODAY":
      return { from: today, to: today };
    case "7D":
    case "7_DAYS":
    case "WEEK": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: formatDateInput(d), to: today };
    }
    case "30D":
    case "30_DAYS": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { from: formatDateInput(d), to: today };
    }
    case "MONTH":
    case "THIS_MONTH": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatDateInput(d), to: today };
    }
    case "CUSTOM": {
      return {
        from: customFrom || today,
        to: customTo || today,
      };
    }
    case "ALL":
    default:
      return { from: "", to: "" };
  }
}

export const getDateRange = calculateDateRange;

export interface DateRangePickerProps {
  value: string;
  onChange: (value: any) => void;
  presets?: Array<DatePresetKey | string>;
  customFrom?: string;
  customTo?: string;
  onCustomFromChange?: (value: string) => void;
  onCustomToChange?: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
  variant?: "segmented" | "dropdown";
}

const DEFAULT_PRESETS: DatePresetKey[] = ["TODAY", "7D", "30D", "MONTH", "CUSTOM"];

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  className = "",
  size = "md",
  variant = "segmented",
}: DateRangePickerProps) {
  const { language, t } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getLabel = (key: string): string => {
    switch (key) {
      case "TODAY":
        return t("common.today");
      case "7D":
      case "7_DAYS":
        return t("common.days7");
      case "WEEK":
        return t("common.thisWeek");
      case "30D":
      case "30_DAYS":
        return t("common.days30");
      case "MONTH":
      case "THIS_MONTH":
        return t("common.thisMonth");
      case "ALL":
        return t("common.all");
      case "CUSTOM":
        return t("common.custom");
      default:
        return key;
    }
  };

  const options = presets.map((p) => ({
    value: p,
    label: getLabel(p),
  }));

  // Handle outside clicks for dropdown variant
  useEffect(() => {
    if (variant !== "dropdown") return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [variant]);

  if (variant === "dropdown") {
    const currentLabel =
      value === "CUSTOM" && customFrom && customTo
        ? `${formatDateShort(customFrom, language)} – ${formatDateShort(customTo, language)}`
        : getLabel(value);

    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#1A2234] hover:bg-gray-50 dark:hover:bg-[#232D42] text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 shadow-xs transition-colors cursor-pointer"
        >
          <Calendar size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span>{currentLabel}</span>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-200 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-40 w-64 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#161D2B] p-2 shadow-xl space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  if (opt.value !== "CUSTOM") {
                    setDropdownOpen(false);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left cursor-pointer ${
                  value === opt.value
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60"
                }`}
              >
                <span>{opt.label}</span>
                {value === opt.value && <Check size={14} />}
              </button>
            ))}

            {value === "CUSTOM" && (
              <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-2 px-1">
                <div className="text-[11px] font-bold text-gray-500 uppercase">
                  {t("common.custom")}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">{t("common.from")}</label>
                    <input
                      type="date"
                      value={customFrom || ""}
                      onChange={(e) => onCustomFromChange?.(e.target.value)}
                      className="w-full text-xs p-1 rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">{t("common.to")}</label>
                    <input
                      type="date"
                      value={customTo || ""}
                      onChange={(e) => onCustomToChange?.(e.target.value)}
                      className="w-full text-xs p-1 rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  {language === "ru" ? "Применить" : language === "uz" ? "Qo'llash" : "Apply"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <SegmentedControl
        value={value}
        onChange={onChange}
        options={options}
        size={size}
      />

      {value === "CUSTOM" && (
        <div className="flex items-center bg-white dark:bg-[#131823] border border-gray-200/80 dark:border-zinc-800 rounded-xl px-3 py-1.5 gap-2 min-h-[38px] shadow-xs">
          <span className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">
            {t("common.from")}:
          </span>
          <input
            type="date"
            value={customFrom || ""}
            onChange={(e) => onCustomFromChange?.(e.target.value)}
            className="bg-transparent text-gray-900 dark:text-white text-xs sm:text-sm font-semibold outline-none cursor-pointer dark:[color-scheme:dark]"
          />
          <span className="text-xs text-gray-400 font-bold">—</span>
          <span className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">
            {t("common.to")}:
          </span>
          <input
            type="date"
            value={customTo || ""}
            onChange={(e) => onCustomToChange?.(e.target.value)}
            className="bg-transparent text-gray-900 dark:text-white text-xs sm:text-sm font-semibold outline-none cursor-pointer dark:[color-scheme:dark]"
          />
        </div>
      )}
    </div>
  );
}
