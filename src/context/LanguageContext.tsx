"use client";
import React, { createContext, useContext, useState } from "react";
import { Locale, translations } from "@/lib/translations";

// 1. 核心修复：接口字段名必须和下面传给 Provider 的 value 一致
interface LanguageContextType {
  locale: Locale; // 保持统一，用 locale 而不是 language
  setLocale: (lang: Locale) => void;
  t: (key: string) => string;
}

// 2. 创建 Context
export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");

  // 3. 翻译函数逻辑
  const t = (key: string) => {
    // 获取当前语言的翻译表，如果找不到 key 就返回 key 本身
    const currentTranslations = translations[locale] as Record<string, string>;
    return currentTranslations[key] || key;
  };

  return (
    // 4. 核心修复：这里的 key 必须对应接口定义的 locale 和 setLocale
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// 5. 官方推荐的 Hook 写法：增加安全检查，避免在使用时还要判断 undefined
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};