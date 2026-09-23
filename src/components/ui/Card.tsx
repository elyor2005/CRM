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
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-2xl p-4 shadow-xs transition-all duration-150 ${
        hoverable || onClick
          ? "cursor-pointer hover:border-gray-300 dark:hover:border-zinc-700 hover:shadow-md active:scale-[0.995]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
