"use client";
//export const runtime = 'edge';

import { useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useLanguage } from "@/context/LanguageContext";
import { getShipmentAction, markInboundAction } from "@/app/actions";

export default function InboundPage() {
  const { t } = useLanguage();
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const inspectionInputRef = useRef<HTMLInputElement>(null);

  // 状态管理
  const [tracking, setTracking] = useState("");
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [inspectionPhoto, setInspectionPhoto] = useState<string | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  
  // 录入数据
  const [quantity, setQuantity] = useState(1);
  const [manualData, setManualData] = useState({ client: "", product: "", warehouse: "Guangzhou" });

  // --- 核心逻辑：统一查询处理 ---
  const handleSearch = async (code: string) => {
    if (!code) return;
    setLoading(true);
    setInspectionPhoto(null); // 切换单号时清空旧照片
    
    try {
      const res = await getShipmentAction(code.trim());
      if (res.success && res.data) {
        // 1. 匹配成功：进入预报模式
        setShipment(res.data);
        setIsNewRecord(false);
      } else {
        // 2. 匹配失败：进入手动录入模式
        setShipment({ tracking_number: code.trim() });
        setIsNewRecord(true);
        // 给个微弱的震动或提示
        console.log("Entering manual mode for:", code);
      }
    } catch (err) {
      alert("查询出错 / Search Error");
    } finally {
      setLoading(false);
    }
  };

  // --- 扫码识别逻辑 ---
  const handleBarcodeCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const html5QrCode = new Html5Qrcode("reader-hidden");
    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      setTracking(decodedText);
      await handleSearch(decodedText); // 扫码后立即触发统一查询
    } catch (err) {
      alert("无法识别条码 / Не удалось распознать штрих-код");
    } finally {
      setLoading(false);
      if (barcodeInputRef.current) barcodeInputRef.current.value = "";
    }
  };

  // --- 拍照处理 ---
  const handleInspectionCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setInspectionPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // --- 提交入库 ---
  const handleConfirm = async () => {
    if (!inspectionPhoto) return alert("请拍照验货！/ Сделайте фото!");
    if (isNewRecord && !manualData.client) return alert("请输入麦头！/ Введите маркировку!");

    setLoading(true);
    try {
      const res = await markInboundAction({
        tracking_number: shipment.tracking_number,
        photo_base64: inspectionPhoto,
        quantity: quantity,
        client_name: isNewRecord ? manualData.client : shipment.client_name,
        product_name: isNewRecord ? manualData.product : shipment.product_name,
        warehouse: isNewRecord ? manualData.warehouse : shipment.warehouse,
        isNew: isNewRecord
      });

      if (res.success) {
        alert("✅ 入库成功！/ Принято!");
        // 重置所有状态
        setShipment(null);
        setTracking("");
        setInspectionPhoto(null);
        setQuantity(1);
        setManualData({ client: "", product: "", warehouse: "Guangzhou" });
      } else {
        alert("❌ 失败: " + res.error);
      }
    } catch (err) {
      alert("系统异常 / System Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white font-sans">
      <div className="max-w-md mx-auto">
        
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-black text-blue-400 uppercase tracking-tighter">
            {t("warehouse_scan")}
          </h1>
          <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase">Terminal v3.0 - Smart Inbound</p>
        </header>

        {/* 1. 单号输入区 */}
        <div className="mb-8 space-y-4">
          <button 
            onClick={() => barcodeInputRef.current?.click()}
            className="w-full py-4 bg-blue-600 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-transform"
          >
            <span className="text-xl">📸</span> 扫码识别 / СКАНИРОВАТЬ
          </button>
          
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-xl p-4 text-lg font-mono outline-none focus:border-blue-500"
              placeholder="手动输入单号..."
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
            <button 
              onClick={() => handleSearch(tracking)}
              className="px-6 bg-slate-700 rounded-xl font-bold hover:bg-slate-600"
            >
              {loading ? "..." : "查询"}
            </button>
          </div>
        </div>

        <div id="reader-hidden" className="hidden"></div>
        <input type="file" accept="image/*" capture="environment" className="hidden" ref={barcodeInputRef} onChange={handleBarcodeCapture} />
        <input type="file" accept="image/*" capture="environment" className="hidden" ref={inspectionInputRef} onChange={handleInspectionCapture} />

        {/* 2. 入库操作卡片 */}
        {shipment && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* 情况 A: 匹配成功 (你刚更新的高颜值 UI) */}
            {!isNewRecord && (
              <div className="space-y-6">
                <div className="relative overflow-hidden bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <div className="absolute -right-4 -top-4 text-emerald-100/50 text-8xl rotate-12 pointer-events-none font-black">✓</div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Matched / 已匹配预报</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 uppercase break-words leading-tight">
                      {shipment.client_name || "未知客户"}
                    </h2>
                    <h2 className="text-3xl font-black text-slate-800 uppercase break-words leading-tight">
                      {shipment.product_name || "未命名产品"}
                    </h2>
                    <div className="mt-3 flex gap-3">
                      <span className="px-2 py-1 bg-white/60 rounded text-[10px] font-bold text-slate-500 border border-emerald-200">
                        仓库: {shipment.warehouse || "GZ"}
                      </span>
                      <span className="px-2 py-1 bg-white/60 rounded text-[10px] font-bold text-slate-400 border border-emerald-200 font-mono">
                        #{shipment.tracking_number?.toString().slice(-6) || "000000"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 数量调节组件 */}
                <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200">
                  <div className="flex justify-between items-end mb-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Quantity / 件数</p>
                    <div className="text-right">
                      <span className="text-4xl font-black text-blue-600">{quantity}</span>
                      <span className="text-xs font-bold text-slate-400 ml-1">PCS</span>
                    </div>
                  </div>
                  <input 
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-white border-2 border-blue-100 focus:border-blue-500 p-4 rounded-2xl text-4xl font-black text-center text-slate-800 outline-none"
                  />
                </div>
              </div>
            )}

            {/* 情况 B: 无预报手动录入 (这里之前漏掉了) */}
            {isNewRecord && (
              <div className="space-y-4">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">New Record / 手动录入模式</p>
                  <p className="text-sm font-bold text-amber-800 mt-1">此单号无预报信息，请手动填写</p>
                </div>
                <input 
                  placeholder="麦头 (Client Name) / МАРКИРОВКА"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold focus:border-amber-500 outline-none"
                  value={manualData.client}
                  onChange={(e) => setManualData({...manualData, client: e.target.value.toUpperCase()})}
                />
                <input 
                  placeholder="品名 (Product) / ТОВАР"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold focus:border-amber-500 outline-none"
                  value={manualData.product}
                  onChange={(e) => setManualData({...manualData, product: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-4">
                  <select 
                    className="bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold outline-none"
                    value={manualData.warehouse}
                    onChange={(e) => setManualData({...manualData, warehouse: e.target.value})}
                  >
                    <option value="Guangzhou">广州 GZ</option>
                    <option value="Yiwu">义乌 YW</option>
                  </select>
                  <input 
                    type="number"
                    className="bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-black text-center"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            )}

            {/* 3. 公共拍照区域 */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase ml-1">Photo Report / 验货照片</p>
              {inspectionPhoto ? (
                <div className="relative">
                  <img src={inspectionPhoto} className="w-full h-48 object-cover rounded-2xl" alt="preview" />
                  <button 
                    onClick={() => setInspectionPhoto(null)}
                    className="absolute top-2 right-2 bg-black/50 text-white w-8 h-8 rounded-full"
                  >✕</button>
                </div>
              ) : (
                <button 
                  onClick={() => inspectionInputRef.current?.click()}
                  className="w-full h-32 border-4 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-slate-300 hover:text-blue-400"
                >
                  <span className="text-4xl mb-1">📸</span>
                  <span className="text-[10px] font-black">TAKE PHOTO / 拍照</span>
                </button>
              )}
            </div>

            {/* 4. 提交按钮 */}
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 ${
                loading ? 'bg-slate-100 text-slate-400' : 'bg-green-500 text-white'
              }`}
            >
              {loading ? "SAVING..." : "📥 确认入库 / CONFIRM"}
            </button>
          </div>
        )}

        <footer className="mt-8 text-center text-slate-600 text-[9px] font-bold uppercase tracking-widest">
          Smart Logistics ERP System
        </footer>
      </div>
    </div>
  );
}