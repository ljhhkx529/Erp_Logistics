"use client";

import React, { useState, useEffect, useRef } from "react";
import { getOutboundBatchesAction, getShipmentsByBatchAction, saveManifestAction } from "@/app/actions/outbound";
import { toPng } from "html-to-image";
import * as XLSX from "xlsx";

// --- Types ---
interface OutboundBatch {
  id: number;
  internal_tracking: string;
  package_type: string;
  insurance_type: string;
  status: number;
  is_manifested: number;
  created_at: string;
}

interface ShipmentItem {
  tracking_number: string;
  product_name: string | null;
  quantity: number | null;
  value_rmb: number | null;
  destination: string | null;
}

interface ManifestFieldProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  onVal: (val: string) => void;
}

export default function ManifestPage() {
  const manifestRef = useRef<HTMLDivElement>(null);
  const [batches, setBatches] = useState<OutboundBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<OutboundBatch | null>(null);
  const [items, setItems] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 🚀 所有字段都在 formData 里，保证 100% 可双向绑定和编辑
  const [formData, setFormData] = useState({
    tracking: "", pieces: "1", transport: "Авто (陆运)", days: "15-25",
    productName: "", weight: "0", volume: "0", density: "0",
    shippingPrice: "0", origin: "Guangzhou (广州)", destination: "",
    consignee: "", phone: "", cargoValue: "0", insurancePercent: "2",
    insuranceAmount: "0", packingFee: "0", handlingFee: "0", totalAmount: "0",
  });

  useEffect(() => {
    getOutboundBatchesAction(0).then(res => {
      if (res.success && res.data) setBatches(res.data as unknown as OutboundBatch[]);
    });
  }, []);

  // 选中批次，拉取数据并做初始的自动计算
  const handleSelectBatch = async (batch: OutboundBatch) => {
    setSelectedBatch(batch);
    setLoading(true);
    const res = await getShipmentsByBatchAction(batch.id);
    if (res.success && res.data) {
      const data = res.data as unknown as ShipmentItem[];
      setItems(data);
      
      const totalValueRMB = data.reduce((sum, i) => sum + (i.value_rmb || 0), 0);
      const cargoValUSD = (totalValueRMB / 7.2).toFixed(2);
      const insPercent = parseFloat(batch.insurance_type) || 2;
      const insAmount = (parseFloat(cargoValUSD) * (insPercent / 100)).toFixed(2);

      setFormData(prev => ({
        ...prev,
        tracking: batch.internal_tracking,
        productName: data[0]?.product_name || "",
        destination: data[0]?.destination || "",
        cargoValue: cargoValUSD,
        insurancePercent: insPercent.toString(),
        insuranceAmount: insAmount,
        pieces: data.length.toString()
      }));
    }
    setLoading(false);
  };

  // 🚀 核心：当基础数据改变时，自动重新计算，但用户依然可以手动修改覆盖
  const handleFormChange = (key: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [key]: value };
      
      // 如果改了 重量、体积、单价 等核心参数，我们帮忙自动算一下（如果你不需要自动算可以删掉这段）
      const w = parseFloat(newData.weight) || 0;
      const v = parseFloat(newData.volume) || 0;
      const sp = parseFloat(newData.shippingPrice) || 0;
      const cv = parseFloat(newData.cargoValue) || 0;
      const ip = parseFloat(newData.insurancePercent) || 0;
      const pf = parseFloat(newData.packingFee) || 0;
      const hf = parseFloat(newData.handlingFee) || 0;

      if (key === 'weight' || key === 'volume') {
        newData.density = v > 0 ? (w / v).toFixed(2) : "0";
      }
      if (key === 'cargoValue' || key === 'insurancePercent') {
        newData.insuranceAmount = (cv * (ip / 100)).toFixed(2);
      }
      
      const calcIns = parseFloat(newData.insuranceAmount) || 0;
      newData.totalAmount = ((w * sp) + calcIns + pf + hf).toFixed(2);

      return newData;
    });
  };

  // 保存到数据库
  const handleSaveToDB = async () => {
    if (!selectedBatch) return;
    setLoading(true);
    
    // 1. 存入 D1 数据库
    const res = await saveManifestAction(selectedBatch.id, formData);
    
    if (res.success) {
      alert("✅ 运单已成功保存至 651Cargo 数据库！");
      
      // 2. 自动下载为图片 (作为备份留底)
      if (manifestRef.current) {
        const dataUrl = await toPng(manifestRef.current, { backgroundColor: "#fff" });
        const link = document.createElement("a");
        link.download = `651Cargo-${formData.tracking}.png`;
        link.href = dataUrl;
        link.click();
      }

      // 3. 刷新列表
      setBatches(prev => prev.filter(b => b.id !== selectedBatch.id));
      setSelectedBatch(null);
    } else {
      alert("❌ 保存失败: " + res.error);
    }
    setLoading(false);
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet([formData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "651Cargo Manifest");
    XLSX.writeFile(wb, `651Cargo-${formData.tracking}.xlsx`);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans relative">
      {loading && (
        <div className="absolute inset-0 z-50 bg-white/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-2xl font-black italic animate-pulse text-blue-600 tracking-widest">PROCESSING...</div>
        </div>
      )}

      {/* ⬅️ 左侧：运单填写与预览区 */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
             <h2 className="font-black italic uppercase text-slate-400">651Cargo Editor / 运单编辑器</h2>
             <div className="flex gap-3">
                <button 
                  onClick={downloadExcel} 
                  disabled={!selectedBatch}
                  className="bg-green-600 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all hover:bg-green-700"
                >导出 Excel</button>
                <button 
                  onClick={handleSaveToDB} 
                  disabled={!selectedBatch}
                  className="bg-blue-600 disabled:bg-slate-300 text-white px-6 py-2 rounded-xl text-sm font-black tracking-widest transition-all hover:bg-blue-700 shadow-lg shadow-blue-200"
                >保存并归档</button>
             </div>
          </div>

          {/* 📄 仿真面单区域 */}
          <div ref={manifestRef} className="bg-white p-10 shadow-2xl border-[1px] border-slate-200 min-h-[1100px] text-[12px]">
            <div className="flex justify-between items-start mb-8 border-b-4 border-black pb-6">
              <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter italic">651 Cargo</h1>
                <p className="text-slate-500 font-bold tracking-widest uppercase text-xs mt-1">Logistics & Forwarding Manifest</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-black uppercase">Грузовая накладная</h2>
                <p className="font-mono text-blue-600 font-bold text-lg mt-1">{formData.tracking || "NO TRACKING"}</p>
              </div>
            </div>

            {/* 核心网格 (全字段 input) */}
            <div className="grid grid-cols-2 border-2 border-black bg-white">
              <ManifestField label="Номер для отслеживания / 运单号" value={formData.tracking} onVal={v => handleFormChange('tracking', v)} highlight />
              <ManifestField label="Кол-во мест / 运输包数" value={formData.pieces} onVal={v => handleFormChange('pieces', v)} />
              
              <div className="border-b border-r border-black p-2 bg-slate-50">
                <label className="block font-bold text-[10px] opacity-50 uppercase mb-1">Наименование / 商品名称</label>
                <input className="w-full font-black text-sm outline-none bg-transparent" value={formData.productName} onChange={e => handleFormChange('productName', e.target.value)} />
              </div>

              <div className="grid grid-cols-3 border-b border-black">
                <ManifestField label="Вес / kg" value={formData.weight} onVal={v => handleFormChange('weight', v)} />
                <ManifestField label="Объём / m³" value={formData.volume} onVal={v => handleFormChange('volume', v)} />
                <ManifestField label="Плотность / 密度" value={formData.density} onVal={v => handleFormChange('density', v)} />
              </div>

              <ManifestField label="Транспорт / 运输方式" value={formData.transport} onVal={v => handleFormChange('transport', v)} />
              <ManifestField label="Срок перевозки / 运输期限" value={formData.days} onVal={v => handleFormChange('days', v)} />
              
              <div className="grid grid-cols-2 border-b border-black">
                <ManifestField label="始发地 / Origin" value={formData.origin} onVal={v => handleFormChange('origin', v)} />
                <ManifestField label="Пункт назначения / 目的地" value={formData.destination} onVal={v => handleFormChange('destination', v)} />
              </div>

              <div className="grid grid-cols-2 border-b border-black">
                <ManifestField label="Грузополучатель / 收货人" value={formData.consignee} onVal={v => handleFormChange('consignee', v)} />
                <ManifestField label="Тел / 电话" value={formData.phone} onVal={v => handleFormChange('phone', v)} />
              </div>

              <div className="grid grid-cols-3 border-b border-black bg-slate-50">
                <ManifestField label="Стоимость / 货值$" value={formData.cargoValue} onVal={v => handleFormChange('cargoValue', v)} />
                <ManifestField label="Страховка / 保险%" value={formData.insurancePercent} onVal={v => handleFormChange('insurancePercent', v)} />
                <ManifestField label="страховка / 保险费$" value={formData.insuranceAmount} onVal={v => handleFormChange('insuranceAmount', v)} highlight />
              </div>

              <div className="grid grid-cols-3 border-b border-black">
                <ManifestField label="Цена доставки / 单价($/kg)" value={formData.shippingPrice} onVal={v => handleFormChange('shippingPrice', v)} />
                <ManifestField label="Упаковка / 包装费$" value={formData.packingFee} onVal={v => handleFormChange('packingFee', v)} />
                <ManifestField label="Погрузочная / 落地费$" value={formData.handlingFee} onVal={v => handleFormChange('handlingFee', v)} />
              </div>

              <div className="col-span-2 p-6 flex justify-between items-center bg-slate-900 text-white">
                <span className="text-xl font-black italic uppercase tracking-widest">Общ. сумма / 总计价格</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">$</span>
                  <input 
                    className="text-4xl font-black italic outline-none bg-transparent text-right w-48 text-blue-400" 
                    value={formData.totalAmount} 
                    onChange={e => handleFormChange('totalAmount', e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* 📦 自动装箱清单区域 */}
            <div className="mt-12">
              <h3 className="font-black border-b-2 border-black mb-4 uppercase italic">Packing List / 装箱清单</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[10px] uppercase">
                    <th className="border border-slate-300 p-2 text-left">Tracking No.</th>
                    <th className="border border-slate-300 p-2 text-left">Product Name</th>
                    <th className="border border-slate-300 p-2 text-center w-16">Qty</th>
                    <th className="border border-slate-300 p-2 text-right w-32">Value (RMB)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 font-mono text-blue-700 font-bold">{item.tracking_number}</td>
                      <td className="p-2 uppercase text-xs font-bold text-slate-600">{item.product_name}</td>
                      <td className="p-2 text-center font-black">{item.quantity}</td>
                      <td className="p-2 text-right font-mono">¥{item.value_rmb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ➡️ 右侧：待制单列表区 */}
      <div className="w-80 bg-white border-l border-slate-200 p-6 overflow-y-auto">
        <h2 className="text-sm font-black uppercase mb-6 text-slate-400 tracking-tighter italic">Pending 651Cargo / 待制单</h2>
        <div className="space-y-3">
          {batches.map(batch => (
            <div 
              key={batch.id}
              onClick={() => handleSelectBatch(batch)}
              className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedBatch?.id === batch.id ? 'border-blue-600 bg-blue-50 scale-[1.02] shadow-md' : 'border-slate-50 hover:border-slate-200'}`}
            >
              <p className="font-mono font-black text-slate-800">#{batch.internal_tracking}</p>
              <div className="flex justify-between mt-2 text-[10px] font-black uppercase text-slate-400">
                <span>{batch.package_type}</span>
                <span>{batch.created_at.split(' ')[0]}</span>
              </div>
            </div>
          ))}
          {batches.length === 0 && <p className="text-center text-slate-300 py-10 font-bold uppercase tracking-widest text-xs">All Clear</p>}
        </div>
      </div>
    </div>
  );
}

// 🚀 核心组件改造：所有 Field 强制渲染为 <input>
function ManifestField({ label, value, highlight, onVal }: ManifestFieldProps) {
  return (
    <div className={`border-b border-r border-black p-3 transition-colors ${highlight ? 'bg-yellow-50' : 'hover:bg-slate-50'}`}>
      <label className="block font-bold text-[9px] opacity-50 uppercase mb-1 leading-none">{label}</label>
      <input 
        type="text"
        className="w-full font-black text-sm outline-none bg-transparent placeholder-slate-200"
        value={value}
        onChange={e => onVal(e.target.value)}
        placeholder="-"
      />
    </div>
  );
}