"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

// 定义主页翻译字典
const i18n = {
  zh: {
    title: "物流 ERP 系统",
    subtitle: "请选择您要进行的操作",
    inboundTitle: "入库录入",
    inboundDesc: "扫描运单、拍摄照片并录入货物信息",
    inventoryTitle: "仓库看板",
    inventoryDesc: "实时查看库存状态、目的地分组及缺失数据",
    enter: "进入系统",
  },
  ru: {
    title: "ERP Система Логистики",
    subtitle: "Выберите действие для продолжения",
    inboundTitle: "Регистрация груза",
    inboundDesc: "Сканируйте трек-номер, делайте фото и вводите данные",
    inventoryTitle: "Складской дашборд",
    inventoryDesc: "Просмотр статуса склада, группировка и проверка данных",
    enter: "Войти",
  }
};

export default function Home() {
  const { locale } = useLanguage();
  const t = i18n[locale as keyof typeof i18n] || i18n.zh;

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 font-sans">
      {/* 头部标题 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t.title}</h1>
        <p className="text-gray-600 text-lg">{t.subtitle}</p>
      </div>

      {/* 导航卡片容器 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        
        {/* 1. 入库录入入口 */}
        <Link href="/warehouse/inbound" className="group">
          <div className="h-full bg-white rounded-2xl p-8 shadow-sm border border-gray-200 transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-2 group-hover:border-blue-500">
            <div className="text-4xl mb-4 text-blue-600">📥</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-blue-600">
              {t.inboundTitle}
            </h2>
            <p className="text-gray-500 mb-6">
              {t.inboundDesc}
            </p>
            <span className="inline-flex items-center text-blue-600 font-semibold">
              {t.enter} <span className="ml-2 transition-transform group-hover:translate-x-2">→</span>
            </span>
          </div>
        </Link>

        {/* 2. 仓库看板入口 */}
        <Link href="/warehouse/inventory" className="group">
          <div className="h-full bg-white rounded-2xl p-8 shadow-sm border border-gray-200 transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-2 group-hover:border-green-500">
            <div className="text-4xl mb-4 text-green-600">📊</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-green-600">
              {t.inventoryTitle}
            </h2>
            <p className="text-gray-500 mb-6">
              {t.inventoryDesc}
            </p>
            <span className="inline-flex items-center text-green-600 font-semibold">
              {t.enter} <span className="ml-2 transition-transform group-hover:translate-x-2">→</span>
            </span>
          </div>
        </Link>

      </div>

      {/* 底部版权或系统版本 */}
      <footer className="mt-20 text-gray-400 text-sm">
        v2.0 | {locale === 'ru' ? 'Для внутреннего использования' : '内部物流系统'}
      </footer>
    </main>
  );
}