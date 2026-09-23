"use client";

import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <div className="text-sm font-medium text-gray-500 dark:text-zinc-400 mt-1">
            {subtitle}
          </div>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
      {children}
    </div>
  );
}
