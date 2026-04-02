"use client";
import { useLanguage } from "@/context/LanguageContext";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex gap-2 justify-end mb-4">
      <button 
        onClick={() => setLocale("zh")}
        className={`px-3 py-1 rounded ${locale === 'zh' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}
      >
        中文
      </button>
      <button 
        onClick={() => setLocale("ru")}
        className={`px-3 py-1 rounded ${locale === 'ru' ? 'bg-red-600 text-white' : 'bg-gray-200 text-black'}`}
      >
        РУС
      </button>
    </div>
  );
}