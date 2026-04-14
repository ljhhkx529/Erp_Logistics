"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { getAllShipmentsAction } from "@/app/actions";
import { createOutboundAction } from "@/app/actions/outbound";

interface Shipment {
  id: number;
  tracking_number: string;
  product_name: string | null;
  value_rmb: number | null;
  status: number;
  quantity: number | null;
  photo_base64: string | null;
}

const i18n = {
  zh: {
    title: "发货制单",
    searchPlaceholder: "搜索快递单号...",
    internalId: "发货单号 (Internal ID)",
    packType: "包装方式",
    insurance: "保险比例",
    submit: "确认发货",
    selectedCount: "已选项目",
    totalValue: "清单货值",
    options: ["原缠", "护角", "木架", "木托", "木箱"],
    empty: "暂无在库货物"
  },
  ru: {
    title: "Оформление отгрузки",
    searchPlaceholder: "Поиск по треку...",
    internalId: "Внутренний номер",
    packType: "Тип упаковки",
    insurance: "Страховка",
    submit: "Отправить",
    selectedCount: "Выбрано",
    totalValue: "Стоимость",
    options: ["Пленка", "Уголки", "Обрешетка", "Паллет", "Ящик"],
    empty: "Склад пуст"
  }
};

export default function ExportPage() {
  const { locale } = useLanguage();
  const t = i18n[locale as keyof typeof i18n] || i18n.zh;

  const [allShipments, setAllShipments] = useState<Shipment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 表单状态
  const [form, setForm] = useState({
    internal_tracking: "",
    package_type: "原缠",
    insurance_type: "2%"
  });

  useEffect(() => {
    async function loadData() {
      const res = await getAllShipmentsAction();
      if (res.success && res.data) {
        const raw = res.data as unknown as Shipment[];
        setAllShipments(raw.filter(s => s.status === 1));
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const filteredItems = allShipments.filter(item => 
    item.tracking_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // 计算总货值仅用于 UI 展示
  const displayTotalValue = allShipments
    .filter(s => selectedIds.includes(s.id))
    .reduce((a, b) => a + (b.value_rmb || 0), 0);

  // 🚀 核心：修正后的提交逻辑，严格匹配你的后端函数签名
  const handleSubmit = async () => {
    if (!form.internal_tracking) return alert("请输入内部单号");
    if (selectedIds.length === 0) return alert("请选择货物");

    try {
      const res = await createOutboundAction({
        internal_tracking: form.internal_tracking,
        shipmentIds: selectedIds,
        package_type: form.package_type,
        insurance_type: form.insurance_type
      });

      if (res.success) {
        alert("发货成功！");
        window.location.reload();
      } else {
        alert(`发货失败: ${res.error}`);
      }
    } catch (e: unknown) {
      alert(`提交出错: ${(e as Error).message}`);
    }
  };

  if (loading) return <div className="p-20 text-center opacity-20 font-black italic">LOADING...</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto p-6 md:p-12">
        <header className="mb-12">
          <h1 className="text-4xl font-black tracking-tighter italic uppercase">{t.title}</h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* 左侧：搜索列表 */}
          <div className="lg:col-span-7">
            <div className="sticky top-6 z-10 bg-white/80 backdrop-blur-md pb-4">
              <input 
                className="w-full bg-slate-100 rounded-3xl px-8 py-5 outline-none focus:ring-4 ring-blue-50 transition-all font-bold text-lg shadow-inner"
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="mt-8 space-y-4">
              {filteredItems.length > 0 ? filteredItems.map(item => (
                <div 
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`flex items-center gap-6 p-6 rounded-[2rem] cursor-pointer transition-all border-4 ${selectedIds.includes(item.id) ? 'border-blue-600 bg-blue-50/50 shadow-lg scale-[1.02]' : 'border-slate-50 hover:border-slate-100 hover:bg-slate-50'}`}
                >
                  <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.photo_base64 || ""} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1">
                    <p className="font-mono font-black text-lg text-blue-700 underline tracking-tighter">#{item.tracking_number}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">{item.product_name || "Unknown Product"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-2xl tracking-tighter">¥{item.value_rmb}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black">{item.quantity} PCS</p>
                  </div>
                </div>
              )) : <p className="text-center py-20 text-slate-200 font-black italic uppercase tracking-widest">{t.empty}</p>}
            </div>
          </div>

          {/* 右侧：配置区域 */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 space-y-8 bg-slate-50 p-10 rounded-[3rem] border border-slate-100 shadow-2xl">
              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block ml-1 tracking-widest">{t.internalId}</label>
                  <input 
                    className="w-full border-b-4 border-slate-200 bg-transparent py-2 focus:border-blue-600 outline-none font-black text-2xl tracking-tighter"
                    placeholder="Archi-LG-01"
                    onChange={e => setForm({...form, internal_tracking: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-4 block ml-1 tracking-widest">{t.packType}</label>
                  <div className="flex flex-wrap gap-2">
                    {t.options.map(opt => (
                      <button 
                        key={opt}
                        onClick={() => setForm({...form, package_type: opt})}
                        className={`px-6 py-3 rounded-2xl text-xs font-black transition-all uppercase ${form.package_type === opt ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white text-slate-300 border border-slate-100 hover:text-slate-500'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block ml-1 tracking-widest">{t.insurance}</label>
                  <input 
                    className="w-full border-b-4 border-slate-200 bg-transparent py-2 focus:border-blue-600 outline-none font-black text-xl"
                    defaultValue="2%"
                    onChange={e => setForm({...form, insurance_type: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-10 border-t-4 border-dotted border-slate-200">
                <div className="flex justify-between items-end mb-8">
                  <div className="space-y-1">
                    <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t.selectedCount}</p>
                    <p className="text-4xl font-black italic tracking-tighter">{selectedIds.length}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t.totalValue}</p>
                    <p className="text-3xl font-black italic tracking-tighter text-blue-600">¥{displayTotalValue}</p>
                  </div>
                </div>
                <button 
                  onClick={handleSubmit}
                  disabled={selectedIds.length === 0}
                  className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-10 shadow-2xl"
                >
                  {t.submit}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}