"use client";

import React, { useState, useEffect, useRef } from "react";
// 如果后续不需要多语言切换，可以暂时不引入 useLanguage
// import { useLanguage } from "@/context/LanguageContext";
import { 
  getOutboundBatchesAction, 
  getShipmentsByBatchAction, 
  markAsManifestedAction,
  unmarkAsManifestedAction // 🚀 新增引入
} from "@/app/actions/outbound";
import { toPng } from "html-to-image";
import * as XLSX from "xlsx";

// 1. 定义批次类型
interface OutboundBatch {
  id: number;
  internal_tracking: string;
  package_type: string;
  insurance_type: string;
  status: number;
  is_manifested: number;
  created_at: string;
}

// 2. 🚀 修改：定义包裹列表项的类型（增加 photo_base64）
interface ShipmentItem {
  tracking_number: string;
  product_name: string | null;
  quantity: number | null;
  value_rmb: number | null;
  destination: string | null;
  photo_base64: string | null; // 🚀 新增图片字段
}

// 3. 定义辅助组件的 Props 类型
interface ManifestFieldProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  isInput?: boolean;
  onVal?: (val: string) => void;
}

export default function ManifestPage() {
  const manifestRef = useRef<HTMLDivElement>(null);
  
  // 状态管理
  const [pendingBatches, setPendingBatches] = useState<OutboundBatch[]>([]); // 🚀 修改：重命名为待制单
  const [manifestedBatches, setManifestedBatches] = useState<OutboundBatch[]>([]); // 🚀 新增：已制单列表
  const [selectedBatch, setSelectedBatch] = useState<OutboundBatch | null>(null);
  const [items, setItems] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 运单字段 (由用户填写或自动带入)
  const [formData, setFormData] = useState({
    tracking: "",
    pieces: 1,
    transport: "Авто (陆运)",
    days: "15-25",
    date: new Date().toISOString().split('T')[0],
    productName: "",
    weight: 0,
    volume: 0,
    shippingPrice: 0, // 单价
    origin: "Guangzhou (广州)",
    destination: "",
    consignee: "",
    phone: "",
    cargoValue: 0,
    domesticFee: 0,
    insurancePercent: 2, // 保险比例 %
    packingFee: 0,
    handlingFee: 0,
  });

// 2. 纯净的数据拉取函数，完全不要在里面写 setLoading
  const refreshLists = async () => {
    // 获取待制单 (is_manifested = 0)
    const resPending = await getOutboundBatchesAction(0);
    if (resPending.success && resPending.data) {
      setPendingBatches(resPending.data as unknown as OutboundBatch[]);
    }
    // 获取已制单 (is_manifested = 1)
    const resManifested = await getOutboundBatchesAction(1);
    if (resManifested.success && resManifested.data) {
      setManifestedBatches(resManifested.data as unknown as OutboundBatch[]);
    }
  }

  // 3. 完美符合规范的 useEffect 写法
  useEffect(() => {
    const initData = async () => {
      // 这里不需要 setLoading(true)，因为初始状态已经是 true 了
      await refreshLists();
      setLoading(false); // 等数据拉取完毕，异步关闭 loading
    };
    
    initData();
  }, []);
  // 2. 选中批次后，自动填入基础信息并加载装箱清单
  const handleSelectBatch = async (batch: OutboundBatch) => {
    setSelectedBatch(batch);
    setLoading(true);
    const res = await getShipmentsByBatchAction(batch.id);
    if (res.success) {
      const data = res.data as unknown as ShipmentItem[];
      setItems(data);
      
      const totalValue = data.reduce((sum: number, i: ShipmentItem) => sum + (i.value_rmb || 0), 0);
      const mainProduct = data[0]?.product_name || "";
      
      setFormData(prev => ({
        ...prev,
        tracking: batch.internal_tracking,
        cargoValue: totalValue / 7.2, // 示例：自动转美元
        productName: mainProduct,
        destination: data[0]?.destination || "",
        insurancePercent: parseFloat(batch.insurance_type) || 2,
        pieces: data.length
      }));
    }
    setLoading(false);
  };

  // 🚀 新增：重新制单逻辑
  const handleReManifest = async (e: React.MouseEvent, batchId: number) => {
    e.stopPropagation(); // 防止触发选中卡片逻辑
    if(!confirm("确定要重新制单吗？该批次将移回待制单列表。")) return;
    
    setLoading(true);
    const res = await unmarkAsManifestedAction(batchId);
    if(res.success) {
      alert("已移回待制单列表");
      refreshLists(); // 刷新两个列表
      if(selectedBatch?.id === batchId) setSelectedBatch(null); // 如果当前选中则取消选中
    } else {
      alert("操作失败: " + res.error);
    }
    setLoading(false);
  }

  // 3. 自动计算逻辑
  const density = formData.volume > 0 ? (formData.weight / formData.volume).toFixed(2) : "0";
  const insuranceAmount = (formData.cargoValue * (formData.insurancePercent / 100)).toFixed(2);
  
  // 总运费计算
  const deliveryCost = (formData.weight * formData.shippingPrice).toFixed(2);
  const totalAmount = (
    parseFloat(deliveryCost) + 
    parseFloat(insuranceAmount) + 
    formData.domesticFee + 
    formData.packingFee + 
    formData.handlingFee
  ).toFixed(2);

  // 4. 生成图片
  const downloadImage = async () => {
    if (manifestRef.current) {
      const dataUrl = await toPng(manifestRef.current, { backgroundColor: "#fff" });
      const link = document.createElement("a");
      link.download = `Invoice-${formData.tracking}.png`;
      link.href = dataUrl;
      link.click();
      await markAsManifestedAction(selectedBatch!.id); 
      // 🚀 修改：制单后直接刷新两个列表
      refreshLists();
      setSelectedBatch(null);
    }
  };

  // 5. 生成 Excel
  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet([{
      "运单号": formData.tracking,
      "重量": formData.weight,
      "总价": totalAmount,
      "目的地": formData.destination
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manifest");
    XLSX.writeFile(wb, `${formData.tracking}.xlsx`);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans relative">
      
      {/* 修复 unused loading: 加载遮罩层 */}
      {loading && (
        <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <div className="text-2xl font-black italic animate-pulse text-blue-600">PROCESSING...</div>
        </div>
      )}

      {/* ⬅️ 左侧：运单填写与预览区 */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
             <h2 className="font-black italic uppercase text-slate-400">Waybill Editor / 运单编辑</h2>
             <div className="flex gap-2">
                <button 
                  onClick={downloadImage} 
                  disabled={!selectedBatch}
                  className="bg-blue-600 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                >保存为图片</button>
                <button 
                  onClick={downloadExcel} 
                  disabled={!selectedBatch}
                  className="bg-green-600 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                >导出Excel</button>
             </div>
          </div>

          {/* 📄 仿真面单区域 */}
          <div ref={manifestRef} className="bg-white p-10 shadow-2xl border-[1px] border-slate-200 min-h-[1100px] text-[12px]">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black uppercase tracking-widest">Cargo Manifest / Грузовая накладная</h1>
              <p className="text-slate-400 font-bold">Logistics & Forwarding Service</p>
            </div>

            {/* 核心网格 */}
            <div className="grid grid-cols-2 border-2 border-black">
              <ManifestField label="Номер для отслеживания / 运单号" value={formData.tracking} highlight />
              <ManifestField label="Кол-во мест / 运输包数" value={formData.pieces} />
              
              <div className="border-b border-r border-black p-2">
                <label className="block font-bold text-[10px] opacity-50 uppercase">Наименование / 商品名称</label>
                {/* 修复致命 Bug: setForm 改成了 setFormData */}
                <input className="w-full font-bold outline-none" value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} />
              </div>

              <div className="grid grid-cols-3 border-b border-black">
                <ManifestField label="Вес/kg" value={formData.weight} isInput onVal={v => setFormData({...formData, weight: parseFloat(v) || 0})} />
                <ManifestField label="Объём/m³" value={formData.volume} isInput onVal={v => setFormData({...formData, volume: parseFloat(v) || 0})} />
                <ManifestField label="Плотность/密度" value={density} />
              </div>

              <ManifestField label="Транспорт / 运输方式" value={formData.transport} />
              <ManifestField label="Срок перевозки / 运输期限" value={formData.days} />
              
              <div className="grid grid-cols-2 border-b border-black">
                <ManifestField label="始发地" value={formData.origin} />
                <ManifestField label="Пункт назначения / 目的地" value={formData.destination} />
              </div>

              <div className="grid grid-cols-2 border-b border-black">
                <ManifestField label="收货人" value={formData.consignee} isInput onVal={v => setFormData({...formData, consignee: v})} />
                <ManifestField label="电话" value={formData.phone} isInput onVal={v => setFormData({...formData, phone: v})} />
              </div>

              <div className="grid grid-cols-3 border-b border-black bg-slate-50">
                <ManifestField label="货值/$" value={formData.cargoValue} />
                <ManifestField label="保险/%" value={formData.insurancePercent} />
                <ManifestField label="保险费/$" value={insuranceAmount} highlight />
              </div>

              <div className="grid grid-cols-3 border-b border-black">
                <ManifestField label="单价 ($/kg)" value={formData.shippingPrice} isInput onVal={v => setFormData({...formData, shippingPrice: parseFloat(v) || 0})} />
                <ManifestField label="包装费/$" value={formData.packingFee} isInput onVal={v => setFormData({...formData, packingFee: parseFloat(v) || 0})} />
                <ManifestField label="落地费/$" value={formData.handlingFee} isInput onVal={v => setFormData({...formData, handlingFee: parseFloat(v) || 0})} />
              </div>

              <div className="col-span-2 p-6 flex justify-between items-center bg-black text-white">
                <span className="text-xl font-black italic uppercase">Общ. сумма / 总计价格</span>
                <span className="text-4xl font-black italic">$ {totalAmount}</span>
              </div>
            </div>

            {/* 📦 自动装箱清单区域 */}
            <div className="mt-10">
              <h3 className="font-black border-b-2 border-black mb-4 uppercase italic">Packing List / 装箱清单</h3>
              <table className="w-full border-collapse table-fixed"> {/* 🚀 修改：增加 table-fixed 稳定布局 */}
                <thead>
                  <tr className="bg-slate-100 text-[10px] uppercase">
                    <th className="border border-slate-300 p-1 w-20">Tracking</th>
                    <th className="border border-slate-300 p-1">Product</th>
                    <th className="border border-slate-300 p-1 w-12">Qty</th>
                    <th className="border border-slate-300 p-1 w-20">Value</th>
                    <th className="border border-slate-300 p-1 w-28">Photo / 照片</th> {/* 🚀 新增图片列 */}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="text-center h-28"> {/* 🚀 增加 h-28 */}
                      <td className="border border-slate-200 p-1 font-mono text-[10px] break-all">{item.tracking_number}</td>
                      <td className="border border-slate-200 p-1 text-left">{item.product_name}</td>
                      <td className="border border-slate-200 p-1">{item.quantity}</td>
                      <td className="border border-slate-200 p-1">¥{item.value_rmb}</td>
                      <td className="border border-slate-200 p-1">
                        {/* 🚀 新增图片展示 */}
                        {item.photo_base64 ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img 
                            src={item.photo_base64} 
                            className="w-full h-24 object-cover rounded shadow-sm" 
                            alt="" 
                          />
                        ) : (
                          <div className="text-slate-300 text-[10px]">No Photo</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ➡️ 右侧：待制单与已制单列表区 */}
      <div className="w-80 bg-white border-l border-slate-200 p-6 overflow-y-auto space-y-8">
        
        {/* 1. 待制单列表 */}
        <section>
          <h2 className="text-sm font-black uppercase mb-6 text-slate-400 tracking-tighter italic">Pending / 待制单</h2>
          <div className="space-y-3">
            {pendingBatches.map(batch => (
              <div 
                key={batch.id}
                onClick={() => handleSelectBatch(batch)}
                className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedBatch?.id === batch.id ? 'border-blue-600 bg-blue-50' : 'border-slate-50 hover:bg-slate-50'}`}
              >
                <p className="font-mono font-bold text-blue-700">#{batch.internal_tracking}</p>
                <div className="flex justify-between mt-2 text-[10px] font-black uppercase text-slate-400">
                  <span>{batch.package_type}</span>
                  <span>{batch.created_at.split(' ')[0]}</span>
                </div>
              </div>
            ))}
            {pendingBatches.length === 0 && <p className="text-center text-slate-300 py-10 font-bold">All Clear</p>}
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* 2. 🚀 新增：已制单展示页逻辑 */}
        <section>
          <h2 className="text-sm font-black uppercase mb-6 text-slate-400 tracking-tighter italic">Manifested / 已制单</h2>
          <div className="space-y-3 opacity-70"> {/* 已制单区域增加不透明度以区分 */}
            {manifestedBatches.map(batch => (
              <div 
                key={batch.id}
                onClick={() => handleSelectBatch(batch)} // 点击已制单依然可以预览面单
                className={`group p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedBatch?.id === batch.id ? 'border-green-600 bg-green-50' : 'border-slate-50 hover:bg-green-50'}`}
              >
                <div className="flex justify-between items-start">
                  <p className="font-mono font-bold text-slate-700 group-hover:text-green-800">#{batch.internal_tracking}</p>
                  {/* 重新制单按钮 */}
                  <button 
                    onClick={(e) => handleReManifest(e, batch.id)}
                    className="text-[10px] bg-white border border-blue-600 text-blue-600 px-2 py-0.5 rounded font-bold hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    重新制单
                  </button>
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-black uppercase text-slate-400">
                  <span>{batch.package_type}</span>
                  <span>{batch.created_at.split(' ')[0]}</span>
                </div>
              </div>
            ))}
            {manifestedBatches.length === 0 && <p className="text-center text-slate-300 py-10">暂无已制单项目</p>}
          </div>
        </section>
      </div>

    </div>
  );
}

// 辅助子组件 (修复了 any 报错，传入 ManifestFieldProps)
function ManifestField({ label, value, highlight, isInput, onVal }: ManifestFieldProps) {
  return (
    <div className={`border-b border-r border-black p-2 ${highlight ? 'bg-yellow-50' : ''}`}>
      <label className="block font-bold text-[9px] opacity-60 uppercase mb-1 leading-none">{label}</label>
      {isInput ? (
        <input 
          type="text"
          className="w-full font-black text-sm outline-none bg-transparent"
          value={value}
          onChange={e => onVal && onVal(e.target.value)}
        />
      ) : (
        <div className="font-black text-sm">{value}</div>
      )}
    </div>
  );
}