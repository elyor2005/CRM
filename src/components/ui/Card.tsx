"use client";

import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({
  children,
  className = "",
  onClick,
  hoverable = false,
}: CardProps) {
  const isInteractive = hoverable || Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#131823] border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all duration-150 ${
        isInteractive
          ? "cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:shadow-md active:scale-[0.995]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
