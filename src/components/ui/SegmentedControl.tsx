"use client";

import React from "react";

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  size?: "sm" | "md";
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className = "",
  size = "md",
}: SegmentedControlProps<T>) {
  const isSm = size === "sm";

  return (
    <div
      className={`inline-flex items-center p-1 bg-gray-100/90 dark:bg-[#1A2234] rounded-xl border border-gray-200/80 dark:border-zinc-800 gap-1 overflow-x-auto scrollbar-none max-w-full ${className}`}
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`transition-all duration-150 rounded-lg font-bold tracking-tight whitespace-nowrap select-none cursor-pointer text-center ${
              isSm ? "px-2.5 py-1 text-xs min-h-[30px]" : "px-3 py-1.5 text-xs sm:text-sm min-h-[34px]"
            } ${
              isActive
                ? "bg-white dark:bg-[#121722] text-gray-900 dark:text-white shadow-xs border border-gray-200/70 dark:border-zinc-700/80"
                : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-zinc-800/50 border border-transparent"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
