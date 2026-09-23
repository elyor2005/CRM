"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/context";
import { Language } from "@/lib/i18n/dictionaries";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const options: { id: Language; label: string }[] = [
    { id: "ru", label: "RU" },
    { id: "uz", label: "UZ" },
    { id: "en", label: "EN" },
  ];

  return (
    <div className="inline-flex items-center bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs font-semibold text-gray-500 dark:text-zinc-400">
      {options.map((opt) => {
        const isActive = language === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setLanguage(opt.id)}
            className={`px-2 py-1 rounded-md transition-all duration-150 ${
              isActive
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-xs"
                : "hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
