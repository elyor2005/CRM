"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { dictionaries, Language } from "./dictionaries";

type DictionaryTree = typeof dictionaries.ru;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_KEY = "crm_app_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ru");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY) as Language;
    if (saved && (saved === "ru" || saved === "uz" || saved === "en")) {
      setLanguageState(saved);
    } else {
      // Auto-detect browser language if preferred
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith("uz")) {
        setLanguageState("uz");
      } else if (browserLang.startsWith("en")) {
        setLanguageState("en");
      }
    }
    setIsInitialized(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_KEY, lang);
    document.cookie = `${LANGUAGE_KEY}=${lang}; path=/; max-age=31536000`;
  };

  const t = (path: string, fallback?: string): string => {
    const keys = path.split(".");
    let current: any = dictionaries[language] || dictionaries.ru;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        // Fallback to Russian dictionary if key missing in selected language
        let fallbackDict: any = dictionaries.ru;
        for (const k of keys) {
          if (fallbackDict && typeof fallbackDict === "object" && k in fallbackDict) {
            fallbackDict = fallbackDict[k];
          } else {
            return fallback || path;
          }
        }
        return typeof fallbackDict === "string" ? fallbackDict : fallback || path;
      }
    }

    return typeof current === "string" ? current : fallback || path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
