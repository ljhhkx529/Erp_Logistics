"use client";

import React, { useEffect, useState } from "react";
import { getAllShipmentsAction } from "@/app/actions"; // 确保路径正确

// 1. 定义严格的接口避免 Lint 错误
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

export default function LogisticsBoard() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const res = await getAllShipmentsAction();
      if (res.success && res.data) {
        // 🚀 过滤掉 status 为 3 的货物
        const filtered = (res.data as unknown as Shipment[]).filter(item => item.status !== 3);
        setShipments(filtered);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // 2. 辅助函数：检查数据是否缺失并返回样式
  const getCellClass = (value: string | number | null) => {
    return !value || value === "" ? "bg-red-100 text-red-600 font-bold" : "text-gray-700";
  };

  // 3. 分组逻辑
  const pendingItems = shipments.filter(s => s.status === 0); // 未到货
  const inWarehouseItems = shipments.filter(s => s.status === 1); // 到仓库

  if (loading) return <div className="p-10 text-center text-xl">正在加载看板数据...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-8 text-3xl font-bold text-gray-800">ERP 物流实时看板</h1>
       {/* --- 图片全屏查看 Modal --- */}
       {selectedImage && (
         <div 
           className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
           onClick={() => setSelectedImage(null)}
         >
           <img 
             src={selectedImage} 
             alt="Full size" 
             className="max-h-full max-w-full rounded-lg shadow-2xl transition-transform"
           />
         </div>
       )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        
        {/* --- 分组一：未到货 (Status 0) --- */}
        <section>
          <div className="mb-4 flex items-center justify-between border-b-4 border-yellow-400 pb-2">
            <h2 className="text-xl font-bold text-yellow-700">🕒 未到货 (Pending)</h2>
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
              {pendingItems.length} 件
            </span>
          </div>
          <div className="space-y-4">
            {pendingItems.map(item => (
              <ShipmentCard 
                 key={item.id} 
                 item={item} 
                 getCellClass={getCellClass} 
                 onImageClick={(src) => setSelectedImage(src)}
                 />
            ))}
          </div>
        </section>

        {/* --- 分组二：到仓库 (Status 1) --- */}
        <section>
          <div className="mb-4 flex items-center justify-between border-b-4 border-green-500 pb-2">
            <h2 className="text-xl font-bold text-green-700">🏠 已入库 (In Warehouse)</h2>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
              {inWarehouseItems.length} 件
            </span>
          </div>
          <div className="space-y-4">
            {inWarehouseItems.map(item => (
                            <ShipmentCard 
                 key={item.id} 
                 item={item} 
                 getCellClass={getCellClass} 
                 onImageClick={(src) => setSelectedImage(src)}
                 />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

// 4. 子组件：货运卡片
{/* eslint-disable-next-line @next/next/no-img-element */}
 function ShipmentCard({ 
   item, 
   getCellClass, 
   onImageClick 
 }: { 
  item: Shipment; 
   getCellClass: (v: unknown) => string;
  onImageClick: (src: string) => void;
 }) {
   const imgSrc = item.photo_base64 
     ? (item.photo_base64.startsWith('data:') ? item.photo_base64 : `data:image/jpeg;base64,${item.photo_base64}`)
     : null;

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-md transition-shadow hover:shadow-lg">
      <div className="flex flex-col md:flex-row">
        
        {/* 产品大图展示区 */}
        <div 
          className="relative w-full bg-gray-200 flex-shrink-0 cursor-zoom-in group"
          style={{ width: '200px', height: '250px', maxWidth: '100%' }}
          onClick={() => imgSrc && onImageClick(imgSrc)}
        >
            {imgSrc ? (
            <img 
               src={imgSrc}
               alt={item.tracking_number}
               className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              无产品图
            </div>
          )}
          <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
            SN: {item.id}
          </div>
        </div>

        {/* 数据详情区 */}
        <div className="flex-1 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-mono font-bold text-blue-600 underline">#{item.tracking_number}</span>
            <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className={`p-1 rounded ${getCellClass(item.client_name)}`}>
              👤 客户: {item.client_name || "缺失"}
            </div>
            <div className={`p-1 rounded ${getCellClass(item.product_name)}`}>
              📦 品名: {item.product_name || "缺失"}
            </div>
            <div className={`p-1 rounded ${getCellClass(item.value_rmb)}`}>
              💰 货值: ¥{item.value_rmb || 0}
            </div>
            <div className={`p-1 rounded ${getCellClass(item.quantity)}`}>
              🔢 件数: {item.quantity || 0}
            </div>
            <div className={`p-1 rounded ${getCellClass(item.destination)}`}>
              📍 目的地: {item.destination || "缺失"}
            </div>
            <div className={`p-1 rounded ${getCellClass(item.warehouse)}`}>
              🏭 仓库: {item.warehouse || "缺失"}
            </div>
            <div className="col-span-2 border-t mt-1 pt-1 text-xs text-gray-500">
              出库单号 (Outbound): {item.outbound_id || "尚未关联"}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}