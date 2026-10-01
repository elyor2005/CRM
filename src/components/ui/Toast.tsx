"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle2, XCircle, AlertCircle, Loader2, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastAction {
  label: string;
  onClick: () => Promise<void> | void;
}

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
  isActionLoading?: boolean;
}

interface ToastContextType {
  showToast: (
    message: string,
    optionsOrType?: ToastType | ToastOptions
  ) => string;
  dismissToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<ToastItem>) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => "",
  dismissToast: () => {},
  updateToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timeoutsRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<ToastItem>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const showToast = useCallback(
    (message: string, optionsOrType?: ToastType | ToastOptions): string => {
      const id = Math.random().toString(36).slice(2);
      let type: ToastType = "success";
      let duration = 5000;
      let action: ToastAction | undefined;

      if (typeof optionsOrType === "string") {
        type = optionsOrType;
      } else if (optionsOrType && typeof optionsOrType === "object") {
        if (optionsOrType.type) type = optionsOrType.type;
        if (optionsOrType.duration !== undefined) duration = optionsOrType.duration;
        if (optionsOrType.action) action = optionsOrType.action;
      }

      const newToast: ToastItem = {
        id,
        message,
        type,
        duration,
        action,
      };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0 && type !== "loading") {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timeoutsRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  const handleActionClick = async (toast: ToastItem) => {
    if (!toast.action || toast.isActionLoading) return;
    try {
      updateToast(toast.id, { isActionLoading: true });
      await toast.action.onClick();
      dismissToast(toast.id);
    } catch (err) {
      updateToast(toast.id, { isActionLoading: false });
      showToast(
        err instanceof Error ? err.message : "Не удалось выполнить действие",
        "error"
      );
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, updateToast }}>
      {children}
      {/* Toast Overlay Container */}
      <div
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center w-full max-w-md px-4 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 w-full py-3 px-4 rounded-2xl shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 border ${
              toast.type === "error"
                ? "bg-rose-950/90 dark:bg-rose-950/90 text-rose-100 border-rose-800/80 shadow-rose-950/30"
                : toast.type === "loading"
                ? "bg-gray-900/90 dark:bg-[#182030]/95 text-white border-indigo-500/50 shadow-indigo-950/20"
                : "bg-gray-900/95 dark:bg-[#182030]/95 text-white border-gray-700/80 dark:border-zinc-700/80 shadow-black/30"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {toast.type === "success" && (
                <CheckCircle2 size={19} className="text-emerald-400 shrink-0" />
              )}
              {toast.type === "error" && (
                <XCircle size={19} className="text-rose-400 shrink-0" />
              )}
              {toast.type === "info" && (
                <AlertCircle size={19} className="text-sky-400 shrink-0" />
              )}
              {toast.type === "loading" && (
                <Loader2 size={19} className="text-indigo-400 animate-spin shrink-0" />
              )}
              <span className="text-sm font-semibold truncate leading-tight">
                {toast.message}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.action && (
                <button
                  type="button"
                  disabled={toast.isActionLoading}
                  onClick={() => handleActionClick(toast)}
                  className="px-2.5 py-1 text-xs font-extrabold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-50"
                >
                  {toast.isActionLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : null}
                  <span>{toast.action.label}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
