// src/app/actions.ts
"use server"; // 必须在第一行，告诉 Next.js 这是后端逻辑

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from 'next/cache';


export async function getShipmentAction(trackingNumber: string) {
  const { env } = getCloudflareContext();
  console.log("🔍 正在查询单号:", `[${trackingNumber}]`); // 加上中括号看有没有空格
  
  try {
    const result = await env.logistics_db.prepare(
      "SELECT * FROM shipments WHERE tracking_number = ?"
    ).bind(trackingNumber.trim()).first(); // 确保用了 trim() 
    
    console.log("📦 数据库返回结果:", result);
    return { success: true, data: result };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 获取所有库存记录
export async function getAllShipmentsAction() {
  const { env } = getCloudflareContext();
  
  try {
    // 按照创建时间倒序排列，最新的在上面
    const { results } = await env.logistics_db.prepare(
      "SELECT * FROM shipments ORDER BY created_at DESC"
    ).all();
    
    return { success: true, data: results };
  } catch (e: any) {
    console.error("🔥 [Server] 获取库存失败:", e.message);
    return { success: false, error: e.message };
  }
}


// src/app/actions.ts

export async function createOutboundBatchAction(data: {
  internal_tracking: string;
  package_type: string;
  insurance_type: string; // 🚀 注意这个名字
  shipment_ids: number[];
}) {
  const { env } = getCloudflareContext();
  if (!env || !env.logistics_db) return { success: false, error: "Database not connected" };

  try {
    // 1. 获取总重量
    const placeholders = data.shipment_ids.map(() => "?").join(",");
    const weightResult: any = await env.logistics_db.prepare(
      `SELECT SUM(weight) as total_w FROM shipments WHERE id IN (${placeholders})`
    ).bind(...data.shipment_ids).first();

    // 2. 插入发货批次 (增加防御性处理，确保没有 undefined)
    const { lastInsertRowid } = await env.logistics_db.prepare(
      `INSERT INTO outbound_batches (internal_tracking, package_type, insurance_type, total_weight, status) 
       VALUES (?, ?, ?, ?, 1)`
    ).bind(
      data.internal_tracking || "N/A",  // 如果没传，给个默认字符串
      data.package_type || "wrapping", 
      data.insurance_type || "none",    // 👈 重点检查这里
      weightResult?.total_w ?? 0        // 如果是 null，转为 0
    ).run();

    // 3. 更新原包裹
    await env.logistics_db.prepare(
      `UPDATE shipments SET outbound_id = ?, status = 2 WHERE id IN (${placeholders})`
    ).bind(lastInsertRowid, ...data.shipment_ids).run();

    return { success: true };
  } catch (e: any) {
    if (e.message.includes("UNIQUE constraint failed")) {
    return { 
      success: false, 
      error: "该自主单号已存在，请换一个新单号！/ Этот номер уже занят!" 
    };
  }
    return { success: false, error: e.message };
  }
}

export async function updateShipmentAction(id: number, data: any) {
  const { env } = getCloudflareContext();
  if (!env || !env.logistics_db) return { success: false, error: "Database not connected" };

  try {
    // 动态构建 SQL 语句
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(key => `${key} = ?`).join(", ");

    await env.logistics_db.prepare(
      `UPDATE shipments SET ${setClause} WHERE id = ?`
    ).bind(...values, id).run();

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// src/app/actions.ts

export async function markInboundAction(data: {
  tracking_number: string;
  photo_base64: string;
  quantity: number;
  client_name?: string;  // 手动录入时使用
  product_name?: string; // 手动录入时使用
  warehouse?: string;    // 手动录入时使用
  isNew?: boolean;       // 标识是否为无预报直接入库
}) {
  const { env } = getCloudflareContext();
  
  try {
    if (data.isNew) {
      // 🚀 逻辑 A：无预报直接入库 (INSERT)
      await env.logistics_db.prepare(`
        INSERT INTO shipments (tracking_number, client_name, product_name, warehouse, photo_base64, quantity, status)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `)
      .bind(
        data.tracking_number.trim(),
        data.client_name || "WALK_IN",
        data.product_name || "General Goods",
        data.warehouse || "Guangzhou",
        data.photo_base64,
        data.quantity
      ).run();
    } else {
      // 🚀 逻辑 B：匹配预报入库 (UPDATE)
      const info = await env.logistics_db.prepare(`
        UPDATE shipments 
        SET status = 1, 
            photo_base64 = ?, 
            quantity = ?
        WHERE tracking_number = ?
      `)
      .bind(data.photo_base64, data.quantity, data.tracking_number.trim())
      .run();

      if (info.meta.changes === 0) return { success: false, error: "Update failed" };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// src/app/actions.ts

export async function submitShipmentAction(data: {
  client: string;
  product: string;
  valueRmb: number; // 用户填写的总货值
  trackingList: string[];
  warehouse: string;
  destination: string;
}) {
  const { env } = getCloudflareContext();
  try {
    // 🚀 核心修复：计算单个包裹的平均货值
    const count = data.trackingList.length;
    const averageValue = count > 0 ? data.valueRmb / count : 0;

    const stmt = env.logistics_db.prepare(
      `INSERT INTO shipments (tracking_number, client_name, product_name, value_rmb, destination, warehouse, status) 
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    );

    // 🚀 批量绑定时，使用计算后的 averageValue
    const batch = data.trackingList.map(track => 
      stmt.bind(
        track.trim(), 
        data.client, 
        data.product, 
        averageValue, // 👈 这里不再是总值，而是分摊后的值
        data.warehouse,
        data.destination
      )
    );
    
    await env.logistics_db.batch(batch);

    return { success: true, count: count };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}