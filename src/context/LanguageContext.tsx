"use client";
import React, { createContext, useContext, useState } from "react";
import { Locale, translations } from "@/lib/translations";

const LanguageContext = createContext<any>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");
  const t = (key: string) => translations[locale][key as keyof typeof translations.zh] || key;

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);