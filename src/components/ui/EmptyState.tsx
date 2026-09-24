"use client";

import React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-xs">
        {icon || <FolderOpen size={24} />}
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
