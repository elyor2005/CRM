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
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 pl-0.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-2.5 bg-gray-100 dark:bg-[#1E2638] text-gray-900 dark:text-white rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:bg-white dark:focus:bg-[#1A202C] disabled:opacity-50 min-h-[44px] ${
            error
              ? "border border-rose-500/60 ring-1 ring-rose-500/20"
              : "border border-gray-200/60 dark:border-zinc-800"
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-rose-500 pl-0.5 font-medium">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
