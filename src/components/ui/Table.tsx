"use client";

import React from "react";

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  alignments?: ("left" | "right" | "center")[];
  className?: string;
}

export function Table({
  headers,
  children,
  alignments = [],
  className = "",
}: TableProps) {
  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-gray-200/80 dark:border-zinc-800 bg-white dark:bg-[#131823] shadow-xs ${className}`}>
      {/* Scrollable Container with Subtle Scroll Hint */}
      <div className="w-full overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-sm border-collapse min-w-[600px] md:min-w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/70 dark:bg-[#182030]/60 text-xs uppercase font-bold text-gray-500 dark:text-zinc-400 tracking-wider">
              {headers.map((header, idx) => {
                const align = alignments[idx] || "left";
                const alignClass =
                  align === "right"
                    ? "text-right"
                    : align === "center"
                    ? "text-center"
                    : "text-left";

                return (
                  <th
                    key={idx}
                    scope="col"
                    className={`px-4 sm:px-5 py-3.5 ${alignClass}`}
                  >
                    {header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60 font-medium">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TableRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function TableRow({ children, onClick, className = "" }: TableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors duration-150 ${
        onClick
          ? "cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 active:bg-indigo-50/80 dark:active:bg-indigo-950/40"
          : "hover:bg-gray-50/50 dark:hover:bg-zinc-800/30"
      } ${className}`}
    >
      {children}
    </tr>
  );
}
