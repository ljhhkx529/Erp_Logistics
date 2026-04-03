"use client";
import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { submitShipmentAction } from "@/app/actions";


export default function CustomerEntry() {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🚀 Toast 状态控制
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState({
    client: "",
    product: "",
    valueRmb: "", // 🚀 新增：货值
    rawTracking: "",
    warehouse: "Guangzhou",
    destination: "Moscow", // 🚀 默认目的地
  });

  // 自动消失的 Toast 逻辑
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const trackingList = useMemo(() => {
    return formData.rawTracking
      .split(/[\n,，\s]+/)
      .filter((item) => item.trim() !== "");
  }, [formData.rawTracking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingList.length === 0) {
      setToast({ msg: "请至少输入一个单号", type: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      // 🚀 这里的参数需要包含 valueRmb
      const result = await submitShipmentAction({
        client: formData.client,
        product: formData.product,
        valueRmb: parseFloat(formData.valueRmb) || 0, // 转换数字
        trackingList: trackingList,
        warehouse: formData.warehouse,
        destination: formData.destination
      });

      if (result.success) {
        setToast({ msg: `✅ ${result.count} 个包裹预报成功！`, type: 'success' });
        setFormData({ client: "", product: "", valueRmb: "", rawTracking: "", warehouse: "",destination:"" });
      } else {
        setToast({ msg: `❌ 失败: ${result.error}`, type: 'error' });
      }
    } catch (error) {
      setToast({ msg: "❌ 网络错误 / Ошибка сети", type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-900 font-sans relative">
      
      {/* 🚀 漂浮 Toast 提示框 */}
      {toast && (
        <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl font-black animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <LanguageSwitcher />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Customer Portal v3.0</span>
        </div>
        
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2">
              {t("title")} / ПРЕДЗАКАЗ
            </h1>
            <div className="h-1.5 w-20 bg-blue-600 mx-auto rounded-full"></div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 客户名称 */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">客户 / КЛИЕНТ</label>
                <input 
                  required
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold"
                  placeholder="Archi / Ira / ..."
                  value={formData.client}
                  onChange={(e) => setFormData({...formData, client: e.target.value})}
                />
              </div>

              {/* 货物类型 */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">品名 / ТОВАР</label>
                <input 
                  required
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold"
                  placeholder="衣服 / Электроника"
                  value={formData.product}
                  onChange={(e) => setFormData({...formData, product: e.target.value})}
                />
              </div>
            </div>

            {/* 🚀 新增：货物价值 (货值) */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">总货值 (¥) / СТОИМОСТЬ (RMB)</label>
              <input 
                required
                type="number"
                className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 focus:bg-white focus:border-blue-500 outline-none transition-all font-mono font-bold text-blue-600"
                placeholder="1000"
                value={formData.valueRmb}
                onChange={(e) => setFormData({...formData, valueRmb: e.target.value})}
              />
            </div>

            {/* 批量单号录入 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">快递单号 / ТРЕК-НОМЕРА</label>
                <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">
                  {trackingList.length} Items
                </span>
              </div>
              <textarea 
                required
                rows={5}
                className="w-full bg-slate-50 border-2 border-slate-50 rounded-3xl p-5 font-mono text-sm focus:bg-white focus:border-blue-500 outline-none transition-all leading-relaxed"
                placeholder="在此粘贴多个单号，用回车或逗号分隔..."
                value={formData.rawTracking}
                onChange={(e) => setFormData({...formData, rawTracking: e.target.value})}
              />
            </div>

            {/* --- 仓库与目的地 栅格布局 --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* 1. 发往仓库 */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  发往仓库 / СКЛАД
                </label>
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 font-bold outline-none focus:border-blue-500 transition-all"
                  value={formData.warehouse}
                  onChange={(e) => setFormData({...formData, warehouse: e.target.value})}
                >
                  <option value="Guangzhou">Гуанчжоу (Guangzhou)</option>
                  <option value="Yiwu">Иу (Yiwu)</option>
                </select>
              </div>

              {/* 2. 目的地 (报错高发区，请确保这里的 div 和 select 都闭合了) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  目的地 / ПУНКТ НАЗНАЧЕНИЯ
                </label>
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 font-bold outline-none focus:border-blue-600 border-l-4 border-l-blue-600 transition-all"
                  value={formData.destination}
                  onChange={(e) => setFormData({...formData, destination: e.target.value})}
                >
                  <option value="Moscow">莫斯科 / Москва (Moscow)</option>
                  <option value="Almaty">阿拉木图 / Алматы (Almaty)</option>
                  <option value="Uzbekistan">乌兹别克斯坦 / Узбекистан (Uzbekistan)</option>
                </select>
              </div>

            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-blue-200 transform active:scale-[0.98] transition-all text-lg uppercase tracking-wider ${
                isSubmitting ? 'bg-slate-300 cursor-not-allowed animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? "Processing..." : "提交预报 / ОТПРАВИТЬ"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}