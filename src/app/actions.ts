"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";

interface Env {
  logistics_db: {
    prepare: (sql: string) => {
      bind: (...args: (string | number | boolean | null)[]) => {
        first: <T = Record<string, unknown>>() => Promise<T | null>;
        all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
        run: () => Promise<{ meta: { changes: number } }>;
      };
    };
    batch: (stmts: unknown[]) => Promise<unknown[]>;
  };
}
// 1. 获取单个单号
export async function getShipmentAction(trackingNumber: string) {
  const { env } = getCloudflareContext();
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
  const { env } = getCloudflareContext();
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
  const { env } = getCloudflareContext();
  if (!env || !env.logistics_db) return { success: false, error: "Database not connected" };

  try {
    const placeholders = data.shipment_ids.map(() => "?").join(",");
    // 🚀 这里给 first 加了泛型，防止结果变成 any
    const weightResult = await env.logistics_db.prepare(
      `SELECT SUM(weight) as total_w FROM shipments WHERE id IN (${placeholders})`
    ).bind(...data.shipment_ids).first<{ total_w: number | null }>();

    const { lastInsertRowid } = await env.logistics_db.prepare(
      `INSERT INTO outbound_batches (internal_tracking, package_type, insurance_type, total_weight, status) 
       VALUES (?, ?, ?, ?, 1)`
    ).bind(
      data.internal_tracking || "N/A",
      data.package_type || "wrapping", 
      data.insurance_type || "none",
      weightResult?.total_w ?? 0
    ).run();

    await env.logistics_db.prepare(
      `UPDATE shipments SET outbound_id = ?, status = 2 WHERE id IN (${placeholders})`
    ).bind(lastInsertRowid, ...data.shipment_ids).run();

    return { success: true };
  } catch (e: unknown) { // 🚀 修复 78:15 处的 any
    const msg = (e as Error).message;
    if (msg.includes("UNIQUE constraint failed")) {
      return { success: false, error: "该自主单号已存在，请换一个新单号！" };
    }
    return { success: false, error: msg };
  }
}

// 4. 更新单号 (修复了 104:15 的 any 错误)
export async function updateShipmentAction(id: number, data: Record<string, string | number | boolean | null>) {
  const { env } = getCloudflareContext();
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
  const { env } = getCloudflareContext();
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
  const { env } = getCloudflareContext();
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