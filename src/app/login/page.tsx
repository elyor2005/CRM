"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Building2, Delete } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

  const handleDigit = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setError("");
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const handleSubmit = async () => {
    if (!pin) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        router.push("/sales");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || t("app.pinIncorrect"));
        setPin("");
      }
    } catch {
      setError("Network error");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-zinc-950 relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm flex flex-col items-center gap-8 bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-3xl p-8 shadow-xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md mb-4">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {t("app.title")}
          </h1>
          <p className="text-sm font-medium text-gray-500 dark:text-zinc-400 mt-1">
            {t("app.enterPin")}
          </p>
        </div>

        {/* PIN indicator dots */}
        <div className="flex gap-4 justify-center my-1">
          {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                error
                  ? "bg-red-500 animate-bounce"
                  : i < pin.length
                  ? "bg-blue-600 scale-110"
                  : "bg-gray-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>

        {error && <p className="text-xs font-semibold text-red-500 text-center -mt-4">{error}</p>}

        {/* Keypad Grid */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["", "0", "delete"],
          ].map((row, ri) => (
            <React.Fragment key={ri}>
              {row.map((key) => {
                if (key === "") return <div key="empty" />;
                if (key === "delete") {
                  return (
                    <button
                      key="delete"
                      type="button"
                      onClick={handleDelete}
                      disabled={loading}
                      className="w-16 h-16 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition-all mx-auto"
                    >
                      <Delete size={22} />
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleDigit(key)}
                    disabled={loading}
                    className="w-16 h-16 rounded-full flex items-center justify-center font-semibold text-xl bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 active:scale-95 transition-all shadow-2xs mx-auto"
                  >
                    {key}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={!pin}
          loading={loading}
          className="w-full"
        >
          {t("app.loginButton")}
        </Button>
      </div>
    </div>
  );
}
