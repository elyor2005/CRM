"use client";

import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function ModalSheet({ open, onClose, title, children }: ModalSheetProps) {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleEsc]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Sheet (Mobile) / Centered Modal (Desktop) */}
      <div className="relative w-full max-h-[90vh] md:max-w-lg bg-white dark:bg-[#131823] rounded-t-3xl md:rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden border border-gray-100 dark:border-zinc-800 transition-all duration-200 animate-in fade-in slide-in-from-bottom-6 md:slide-in-from-bottom-2">
        {/* Mobile handle bar indicator */}
        <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mt-2.5 mb-1 md:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800/80">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-70px)]">{children}</div>
      </div>
    </div>
  );
}

export const BottomSheet = ModalSheet;
