"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 pl-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl outline-none text-base transition-all focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 min-h-[44px] ${
            error ? "border border-red-500/50" : "border border-transparent"
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-red-500 pl-1 font-medium">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
