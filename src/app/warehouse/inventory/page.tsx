"use client";
export const runtime = 'edge';

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { getAllShipmentsAction, updateShipmentAction,createOutboundBatchAction} from "@/app/actions";

export default function InventoryPage() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  
  // 🚀 发货多选与弹窗状态
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showOutboundModal, setShowOutboundModal] = useState(false);
  const [outboundForm, setOutboundForm] = useState({
    internal_tracking: "",
    package_type: "bag",
    insurance: "none"
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const res = await getAllShipmentsAction();
    if (res.success) setShipments(res.data);
    setLoading(false);
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditData({ ...item });
  };

  const handleSave = async (id: number) => {
    setLoading(true);
    const { id: _, created_at: __, ...updateData } = editData;
    updateData.weight = parseFloat(updateData.weight) || 0;
    updateData.quantity = parseInt(updateData.quantity) || 1;
    updateData.status = parseInt(updateData.status);

    const res = await updateShipmentAction(id, updateData);
    setLoading(false);
    if (res.success) {
      alert("更新成功！/ Успешно обновлено");
      setEditingId(null);
      loadData();
    }
  };
  // 🚀 在 InventoryPage 组件内部，handleSave 下方添加
  const handleOutboundSubmit = async () => {
    // 1. 校验必填项
    if (!outboundForm.internal_tracking) {
      alert("请输入自主单号！/ Введите номер карго!");
      return;
    }
    if (selectedIds.length === 0) return;

    setLoading(true);
    console.log("🚢 [Client] 准备发货，选中 ID:", selectedIds);

    try {
      // 2. 调用后端 Action
      const res = await createOutboundBatchAction({
        internal_tracking: outboundForm.internal_tracking,
        package_type: outboundForm.package_type,
        insurance_type: outboundForm.insurance,
        shipment_ids: selectedIds
      });

      if (res.success) {
        console.log("✅ [Client] 发货单生成成功");
        alert("发货单已生成！/ Партия сформирована!");
        
        // 3. 重置状态
        setShowOutboundModal(false);
        setSelectedIds([]); // 清空勾选
        setOutboundForm({ internal_tracking: "", package_type: "wrapping", insurance: "none" });
        
        // 4. 重新加载库存数据（此时选中的包裹状态会变，或者被过滤掉）
        loadData();
      } else {
        console.error("❌ [Client] 发货失败:", res.error);
        alert("错误: " + res.error);
      }
    } catch (err) {
      console.error("💥 [Client] 提交崩溃:", err);
    } finally {
      setLoading(false);
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.length === shipments.length) setSelectedIds([]);
    else setSelectedIds(shipments.map(s => s.id));
  };

  return (
    <>
      <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-24">
        <div className="max-w-[95rem] mx-auto p-6 md:p-8">
          
          {/* 顶部工具栏 */}
          <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏢</span>
              <h1 className="text-3xl font-black uppercase tracking-tighter">
                {t("nav_inventory")} / СКЛАД
              </h1>
            </div>
            
            <button 
              onClick={() => { setIsLocked(!isLocked); setEditingId(null); }}
              className={`px-8 py-4 rounded-2xl font-black transition-all transform active:scale-95 shadow-md ${
                isLocked ? 'bg-slate-100 text-slate-400' : 'bg-orange-500 text-white shadow-lg shadow-orange-200 scale-105'
              }`}
            >
              {isLocked ? "🔓 解锁编辑 / РАЗБЛОКИРОВАТЬ" : "🔒 锁定数据 / ЗАБЛОКИРОВАТЬ"}
            </button>
          </div>

          {/* 表格容器 */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
            <table className="w-full text-left table-auto">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-black border-b border-slate-100">
                <tr>
                  <th className="px-5 py-5 w-16 text-center">
                    <input type="checkbox" className="w-4 h-4" onChange={toggleSelectAll} checked={selectedIds.length === shipments.length && shipments.length > 0} />
                  </th>
                  <th className="px-5 py-5 min-w-[150px]">快递单号</th>
                  <th className="px-5 py-5 min-w-[100px]">客户</th>
                  <th className="px-5 py-5 min-w-[120px]">品名</th>
                  <th className="px-5 py-5 min-w-[120px]">目的地</th>
                  <th className="px-5 py-5 min-w-[100px]">仓库</th>
                  <th className="px-5 py-5 text-right w-24">件数(pcs)</th>
                  <th className="px-5 py-5 text-center w-28">状态</th>
                  <th className="px-5 py-5 text-center w-24">图片</th>
                  <th className="px-5 py-5 text-center w-28">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {shipments.map((s) => (
                  <tr key={s.id} className={`${editingId === s.id ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'} transition-colors`}>
                    <td className="px-5 py-4 text-center">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-blue-600 cursor-pointer"
                          checked={selectedIds.includes(s.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, s.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== s.id));
                          }}
                        />
                    </td>
                    
                    {editingId === s.id ? (
                      /* 编辑模式 */
                      <>
                        <td className="px-4 py-3"><input className="w-full p-2 border rounded font-mono text-xs" value={editData.tracking_number} onChange={e => setEditData({...editData, tracking_number: e.target.value})} /></td>
                        <td className="px-4 py-3"><input className="w-full p-2 border rounded font-bold" value={editData.client_name} onChange={e => setEditData({...editData, client_name: e.target.value})} /></td>
                        <td className="px-4 py-3"><input className="w-full p-2 border rounded" value={editData.product_name} onChange={e => setEditData({...editData, product_name: e.target.value})} /></td>
                        <td className="px-4 py-3"><input className="w-full p-2 border rounded" value={editData.destination} onChange={e => setEditData({...editData, destination: e.target.value})} /></td>
                        <td className="px-4 py-3"><select className="w-full p-2 border rounded" value={editData.warehouse} onChange={e => setEditData({...editData, warehouse: e.target.value})}><option value="Guangzhou">Guangzhou</option><option value="Yiwu">Yiwu</option></select></td>
                        <td className="px-4 py-3"><input className="w-full p-2 border rounded text-right" type="number" value={editData.quantity} onChange={e => setEditData({...editData, quantity: e.target.value})} /></td>
                        <td className="px-4 py-3"><select className="w-full p-2 border rounded" value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})}><option value="0">Pending</option><option value="1">Received</option></select></td>
                        <td className="px-4 py-3 text-center">📸</td>
                        <td className="px-4 py-3 text-center space-y-1">
                          <button onClick={() => handleSave(s.id)} className="w-full text-xs bg-green-500 text-white py-1 rounded">保存</button>
                          <button onClick={() => setEditingId(null)} className="w-full text-xs text-slate-400">取消</button>
                        </td>
                      </>
                    ) : (
                      /* 只读模式 */
                      <>
                        <td className="px-5 py-4 font-mono text-xs">{s.tracking_number}</td>
                        <td className="px-5 py-4 font-bold">{s.client_name}</td>
                        <td className="px-5 py-4">{s.product_name || "---"}</td>
                        <td className="px-5 py-4"><span className="bg-slate-100 px-3 py-1 rounded-full text-xs">{s.destination || '---'}</span></td>
                        <td className="px-5 py-4">{s.warehouse || "广州"}</td>
                        <td className="px-5 py-4 text-right font-black">{s.quantity}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${s.status === 1 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {s.status === 1 ? "На складе" : "В пути"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {s.photo_base64 ? <img src={s.photo_base64} className="w-10 h-10 object-cover rounded mx-auto" /> : "无"}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {!isLocked && <button onClick={() => startEdit(s)} className="text-blue-600 font-bold text-xs hover:underline">修改</button>}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🚀 右下角悬浮发货按钮 (Floating Action Button) */}
      <div className="fixed bottom-10 right-10 z-50">
        <button 
          onClick={() => selectedIds.length > 0 ? setShowOutboundModal(true) : alert("请勾选包裹！")}
          className={`flex items-center gap-3 px-8 py-5 rounded-full font-black text-xl shadow-2xl transition-all transform hover:scale-110 active:scale-95 ${
            selectedIds.length > 0 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>🚢</span> 发货 / ОТПРАВИТЬ 
          {selectedIds.length > 0 && <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-sm ml-1">{selectedIds.length}</span>}
        </button>
      </div>

      {/* 🚀 发货单生成弹窗 (Outbound Modal) */}
      {showOutboundModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-slate-900 uppercase">生成发货批次 / ГРУЗ</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">自主单号 / КАРГО-НОМЕР</label>
                <input 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-blue-500"
                  placeholder="如: MSK-ARCHI-001"
                  value={outboundForm.internal_tracking}
                  onChange={(e) => setOutboundForm({...outboundForm, internal_tracking: e.target.value})}
                />
              </div>

              {/* 📦 打包方式选择 (Упаковка) */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">打包方式 / УПАКОВКА</label>
                <select 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold"
                  value={outboundForm.package_type}
                  onChange={(e) => setOutboundForm({...outboundForm, package_type: e.target.value})}
                >
                  <option value="wrapping">原缠 (Обычная обмотка)</option>
                  <option value="edge">护边 (Защитные уголки)</option>
                  <option value="frame">木架 (Деревянная обрешётка)</option>
                  <option value="pallet">木托 (Поддон)</option>
                  <option value="box">木箱 (Деревянный ящик)</option>
                </select>
              </div>

              {/* 🛡️ 保险比例选择 (Страховка) */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">保险 / СТРАХОВКА</label>
                <select 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold"
                  value={outboundForm.insurance}
                  onChange={(e) => setOutboundForm({...outboundForm, insurance: e.target.value})}
                >
                  <option value="none">无保险 (Без страховки)</option>
                  <option value="1%">1% 保险 (Страховка 1%)</option>
                  <option value="2%">2% 保险 (Страховка 2%)</option>
                  <option value="3%">3% 保险 (Страховка 3%)</option>
                  <option value="4%">4% 保险 (Страховка 4%)</option>
                  <option value="5%">5% 保险 (Страховка 5%)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowOutboundModal(false)} className="flex-1 py-4 font-bold text-slate-400">取消</button>
              <button onClick={handleOutboundSubmit} className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg">确认发出 / ПРОВЕРИТЬ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}