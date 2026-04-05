"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1Database } from "@cloudflare/workers-types";

// 定义你自己数据库的形状
interface MyCustomEnv {
  logistics_db: D1Database;
  // 如果还有别的环境变量也可以写在这
}
// 1. 获取单个单号
export async function getShipmentAction(trackingNumber: string) {
  const { env } = getCloudflareContext() as unknown as { env: MyCustomEnv };
  try {
    const result = await env.logistics_db.prepare(
      "SELECT * FROM shipments WHERE tracking_number = ?"
    ).bind(trackingNumber.trim()).first();
    return { success: true, data: result };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

// 2. 获取所有记录
export async function getAllShipmentsAction() {
  const { env } = getCloudflareContext() as unknown as { env: MyCustomEnv };
  try {
    const { results } = await env.logistics_db.prepare(
      "SELECT * FROM shipments ORDER BY created_at DESC"
    ).all();
    return { success: true, data: results };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

// 3. 批量发货 (修复了 78:15 的 any 错误)
export async function createOutboundBatchAction(data: {
  internal_tracking: string;
  package_type: string;
  insurance_type: string;
  shipment_ids: number[];
}) {
  // 🚀 1. 强行断言，确保 env 及其方法被 TS 识别
  const { env } = getCloudflareContext() as unknown as { env: MyCustomEnv };
  if (!env || !env.logistics_db) return { success: false, error: "Database not connected" };

  try {
    const placeholders = data.shipment_ids.map(() => "?").join(",");
    
    // 获取总重量
    const weightResult = await env.logistics_db.prepare(
      `SELECT SUM(weight) as total_w FROM shipments WHERE id IN (${placeholders})`
    ).bind(...data.shipment_ids).first<{ total_w: number | null }>();

    // 🚀 2. 核心修复：不要直接解构 lastInsertRowid，D1 不支持这种写法
    const insertResult = await env.logistics_db.prepare(
      `INSERT INTO outbound_batches (internal_tracking, package_type, insurance_type, total_weight, status) 
       VALUES (?, ?, ?, ?, 1)`
    ).bind(
      data.internal_tracking || "N/A",
      data.package_type || "wrapping", 
      data.insurance_type || "none",
      weightResult?.total_w ?? 0
    ).run();

    // 🚀 3. 官方标准取法：从 meta 对象中获取 last_row_id
    const lastId = insertResult.meta.last_row_id;

    // 4. 更新原包裹状态，使用拿到的 lastId
    await env.logistics_db.prepare(
      `UPDATE shipments SET outbound_id = ?, status = 2 WHERE id IN (${placeholders})`
    ).bind(lastId, ...data.shipment_ids).run();

    return { success: true };
  } catch (e: unknown) {
    const msg = (e as Error).message;
    if (msg.includes("UNIQUE constraint failed")) {
      return { success: false, error: "该自主单号已存在，请换一个新单号！" };
    }
    return { success: false, error: msg };
  }
}

// 4. 更新单号 (修复了 104:15 的 any 错误)
export async function updateShipmentAction(id: number, data: Record<string, string | number | boolean | null>) {
  const { env } = getCloudflareContext() as unknown as { env: MyCustomEnv };
  if (!env || !env.logistics_db) return { success: false, error: "Database not connected" };

  try {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(key => `${key} = ?`).join(", ");

    await env.logistics_db.prepare(
      `UPDATE shipments SET ${setClause} WHERE id = ?`
    ).bind(...values, id).run();

    return { success: true };
  } catch (e: unknown) { // 🚀 修复 104:15 处的 any
    return { success: false, error: (e as Error).message };
  }
}

// 5. 入库操作 (修复了 153:15 的 any 错误)
export async function markInboundAction(data: {
  tracking_number: string;
  photo_base64: string;
  quantity: number;
  client_name?: string;
  product_name?: string;
  warehouse?: string;
  isNew?: boolean;
}) {
  const { env } = getCloudflareContext() as unknown as { env: MyCustomEnv };
  try {
    if (data.isNew) {
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
      const info = await env.logistics_db.prepare(`
        UPDATE shipments SET status = 1, photo_base64 = ?, quantity = ? WHERE tracking_number = ?
      `)
      .bind(data.photo_base64, data.quantity, data.tracking_number.trim())
      .run();

      if (info.meta.changes === 0) return { success: false, error: "Update failed" };
    }
    return { success: true };
  } catch (e: unknown) { // 🚀 修复 153:15 处的 any
    return { success: false, error: (e as Error).message };
  }
}

// 6. 提交预报 (修复了 194:15 的 any 错误)
export async function submitShipmentAction(data: {
  client: string;
  product: string;
  valueRmb: number;
  trackingList: string[];
  warehouse: string;
  destination: string;
}) {
  const { env } = getCloudflareContext() as unknown as { env: MyCustomEnv };
  try {
    const count = data.trackingList.length;
    const averageValue = count > 0 ? data.valueRmb / count : 0;

    const stmt = env.logistics_db.prepare(
      `INSERT INTO shipments (tracking_number, client_name, product_name, value_rmb, destination, warehouse, status) 
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    );

    const batch = data.trackingList.map(track => 
      stmt.bind(
        track.trim(), 
        data.client, 
        data.product, 
        averageValue,
        data.destination,
        data.warehouse
      )
    );
    
    await env.logistics_db.batch(batch);
    return { success: true, count: count };
  } catch (e: unknown) { // 🚀 修复 194:15 处的 any
    return { success: false, error: (e as Error).message };
  }
}