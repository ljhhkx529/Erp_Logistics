"use client";

import React, { useEffect, useState, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { getAllShipmentsAction } from "@/app/actions"; 
import { createOutboundAction } from "@/app/actions/outbound";
import { toPng } from "html-to-image"; // 需要安装: npm install html-to-image

// 俄语/中文翻译
const i18n = {
  zh: {
    title: "创建发货单 (Outbound)",
    internalLabel: "发货单号 (例: Oleg-LG)",
    packType: "包装方式",
    insurance: "保险比例 (%)",
    submit: "提交发货并生成清单",
    warningValue: "提醒：部分货物未录入货值，是否继续？",
    selected: "已选数量",
    totalValue: "总货值",
  },
  ru: {
    title: "Создание отгрузки (Outbound)",
    internalLabel: "Внутренний номер (напр. Oleg-LG)",
    packType: "Тип упаковки",
    insurance: "Страховка (%)",
    submit: "Отправить и создать манифест",
    warningValue: "Внимание: у некоторых товаров нет стоимости. Продолжить?",
    selected: "Выбрано",
    totalValue: "Общая стоимость",
  }
};

// 在文件顶部确保定义了 Shipment 接口（如果没有，请添加）
interface Shipment {
  id: number;
  tracking_number: string;
  client_name: string | null;
  product_name: string | null;
  value_rmb: number | null;
  status: number;
  destination: string | null;
  warehouse: string | null;
  quantity: number | null;
  photo_base64: string | null;
  outbound_id: number | null;
  created_at: string;
}

export default function ExportPage() {
  const { locale } = useLanguage();
  const t = i18n[locale as keyof typeof i18n] || i18n.zh;
  
  const [list, setList] = useState<Shipment[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [form, setForm] = useState({ internal_tracking: "", package_type: "Box", insurance_type: "0" });
  const manifestRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchData() {
        const res = await getAllShipmentsAction();
        if (res.success && res.data) {
            // 🚀 核心：先转为 unknown，再断言为我们的 Shipment 数组
            // 这样 TS 就知道 item 拥有 status, tracking_number 等属性了
            const rawData = res.data as unknown as Shipment[];
            
            // 过滤逻辑：只展示在库货物 (status 1)
            const inWarehouse = rawData.filter((item) => item.status === 1);
            
            setList(inWarehouse);
        }
        }
        fetchData();
    }, []);

  const handleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const calculateTotal = () => {
    return list.filter(i => selectedIds.includes(i.id)).reduce((sum, i) => sum + (i.value_rmb || 0), 0);
  };

  const handleExport = async () => {
    const selectedItems = list.filter(i => selectedIds.includes(i.id));
    const hasZeroValue = selectedItems.some(i => !i.value_rmb || i.value_rmb === 0);

    if (hasZeroValue && !confirm(t.warningValue)) return;
    if (!form.internal_tracking) return alert("请输入发货单号");

    // 1. 生成 PNG 清单
    if (manifestRef.current) {
      const dataUrl = await toPng(manifestRef.current);
      const link = document.createElement('a');
      link.download = `${form.internal_tracking}.png`;
      link.href = dataUrl;
      link.click();
    }

    // 2. 提交数据库
    const res = await createOutboundAction({
      ...form,
      shipmentIds: selectedIds
    });

    if (res.success) {
      alert("发货成功！");
      window.location.reload();
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <h1 className="text-2xl font-bold mb-6">{t.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：货物选择列表 */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-4">
          <div className="space-y-2">
            {list.map(item => (
              <div 
                key={item.id} 
                onClick={() => handleSelect(item.id)}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedIds.includes(item.id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <input type="checkbox" checked={selectedIds.includes(item.id)} readOnly className="mr-3" />
                <img src={item.photo_base64} className="w-12 h-12 object-cover rounded mr-3" alt="" />
                <div className="flex-1">
                  <div className="font-mono text-sm font-bold">{item.tracking_number}</div>
                  <div className="text-xs text-gray-500">{item.product_name} | ¥{item.value_rmb}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：发货参数填写 */}
        <div className="bg-white rounded-xl shadow p-6 h-fit sticky top-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.internalLabel}</label>
              <input 
                type="text" 
                className="mt-1 block w-full border rounded-md p-2"
                onChange={e => setForm({...form, internal_tracking: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.packType}</label>
              <select className="mt-1 block w-full border rounded-md p-2" onChange={e => setForm({...form, package_type: e.target.value})}>
                <option value="Box">箱装 (Коробка)</option>
                <option value="Bag">袋装 (Мешок)</option>
                <option value="Wooden">木架 (Дерево)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.insurance}</label>
              <input type="number" className="mt-1 block w-full border rounded-md p-2" onChange={e => setForm({...form, insurance_type: e.target.value})} />
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm mb-1">
                <span>{t.selected}:</span> <span className="font-bold">{selectedIds.length}</span>
              </div>
              <div className="flex justify-between text-lg mb-4">
                <span>{t.totalValue}:</span> <span className="font-bold text-blue-600">¥{calculateTotal()}</span>
              </div>
              <button 
                onClick={handleExport}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                {t.submit}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 隐藏的清单区域：用于生成 PNG */}
      <div className="fixed left-[-9999px]">
        <div ref={manifestRef} className="bg-white p-8 w-[800px]" style={{ fontFamily: 'sans-serif' }}>
          <h2 className="text-2xl font-bold mb-4 border-b-2 pb-2">Manifest: {form.internal_tracking}</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border text-sm">Tracking</th>
                <th className="p-2 border text-sm">Product</th>
                <th className="p-2 border text-sm">Qty</th>
                <th className="p-2 border text-sm">Photo</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id}>
                  <td className="p-4 border font-mono text-sm">{item.tracking_number}</td>
                  <td className="p-4 border text-sm">{item.product_name}</td>
                  <td className="p-4 border text-sm">{item.quantity}</td>
                  <td className="p-4 border">
                    <img 
                      src={item.photo_base64} 
                      className="w-32 h-32 object-cover rounded shadow-sm" 
                      alt="" 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            <div className="mt-4 text-right text-gray-500 text-xs">Generated by Oleg ERP</div>
        </div>
      </div>
    </div>
  );
}