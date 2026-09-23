"use client";

import React from "react";

type BadgeVariant =
  | "debt"
  | "settled"
  | "overpaid"
  | "sale"
  | "return"
  | "income"
  | "expense";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className = "" }: BadgeProps) {
  const styles: Record<BadgeVariant, string> = {
    debt: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50 dark:border-red-900/40",
    settled:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40",
    overpaid:
      "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40",
    sale: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40",
    return:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40",
    income:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40",
    expense:
      "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50 dark:border-red-900/40",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-tight whitespace-nowrap ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
