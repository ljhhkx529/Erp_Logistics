"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1Database } from "@cloudflare/workers-types";
// 定义你自己数据库的形状
interface MyCustomEnv {
  logistics_db: D1Database;
  // 如果还有别的环境变量也可以写在这
}

export interface ManifestFormData {
  tracking: string;
  pieces: string;
  productName: string;
  weight: string;
  volume: string;
  density: string;
  transport: string;
  days: string;
  origin: string;
  destination: string;
  consignee: string;
  phone: string;
  cargoValue: string;
  insurancePercent: string;
  insuranceAmount: string;
  shippingPrice: string;
  packingFee: string;
  handlingFee: string;
  totalAmount: string;
}

// 🚀 新增：取消标记为已制单（用于重新制单）
export async function unmarkAsManifestedAction(batchId: number) {
  const { env } = (await getCloudflareContext()) as unknown as {env: MyCustomEnv};
  try {
    // 1. 将批次标记为未制单 (is_manifested = 0)
    await env.logistics_db.prepare(
      `UPDATE outbound_batches SET is_manifested = 0 WHERE id = ?`
    ).bind(batchId).run();

    // 2. (可选) 你可以选择在这里删除 cargo_manifests 表中对应的旧面单数据
    // await env.logistics_db.prepare(`DELETE FROM cargo_manifests WHERE batch_id = ?`).bind(batchId).run();

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

// 保存完整的面单数据到数据库，并标记批次为已制单
export async function saveManifestAction(batchId: number, formData: ManifestFormData) {
  const { env } = (await getCloudflareContext()) as unknown as {env: MyCustomEnv};
  const db = env.logistics_db;

  try {
    const statements = [];

    // 1. 插入面单表
    statements.push(
      db.prepare(`
        INSERT INTO cargo_manifests (
          batch_id, tracking_number, pieces, product_name, weight, volume, density,
          transport_type, transport_days, origin, destination, consignee, phone,
          cargo_value, insurance_percent, insurance_amount, shipping_price,
          packing_fee, handling_fee, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        batchId, formData.tracking, formData.pieces, formData.productName,
        formData.weight, formData.volume, formData.density, formData.transport,
        formData.days, formData.origin, formData.destination, formData.consignee,
        formData.phone, formData.cargoValue, formData.insurancePercent,
        formData.insuranceAmount, formData.shippingPrice, formData.packingFee,
        formData.handlingFee, formData.totalAmount
      )
    );

    // 2. 更新批次状态为已制单
    statements.push(
      db.prepare(`UPDATE outbound_batches SET is_manifested = 1 WHERE id = ?`).bind(batchId)
    );

    // 3. 执行事务
    await db.batch(statements);

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getOutboundBatchesAction(is_manifested: number = 0) {
  const { env } = (await getCloudflareContext()) as unknown as {env: MyCustomEnv};
  try {
    const res = await env.logistics_db.prepare(
      `SELECT * FROM outbound_batches WHERE is_manifested = ? ORDER BY created_at DESC`
    ).bind(is_manifested).all();
    return { success: true, data: res.results };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

// 根据批次 ID 获取所有相关的包裹（用于填充装箱清单）
export async function getShipmentsByBatchAction(batchId: number) {
  const { env } = (await getCloudflareContext()) as unknown as {env: MyCustomEnv};
  try {
    const res = await env.logistics_db.prepare(
      `SELECT * FROM shipments WHERE outbound_id = ?`
    ).bind(batchId).all();
    return { success: true, data: res.results };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

// 制单完成后，标记该批次为已制单
export async function markAsManifestedAction(batchId: number) {
    const { env } = (await getCloudflareContext()) as unknown as {env: MyCustomEnv};
  try {
    await env.logistics_db.prepare(
      `UPDATE outbound_batches SET is_manifested = 1 WHERE id = ?`
    ).bind(batchId).run();
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export async function createOutboundAction(formData: {
  internal_tracking: string;
  shipmentIds: number[];
  package_type: string;
  insurance_type: string;
}) {
  const { env } = (await getCloudflareContext()) as unknown as {env: MyCustomEnv};
  const db = env.logistics_db;

  try {
    // 1. 开启事务 (D1 批处理)
    const statements = [];

    // 2. 插入发货批次
    statements.push(
      db.prepare(`
        INSERT INTO outbound_batches (internal_tracking, package_type, insurance_type, status)
        VALUES (?, ?, ?, 1)
      `).bind(formData.internal_tracking, formData.package_type, formData.insurance_type)
    );

    // 3. 更新选中的包裹状态 (status 3 代表已发出)
    // 注意：这里我们假设 internal_tracking 是唯一的，稍后通过它查询 ID 或直接使用
    const updateStmt = db.prepare(`
      UPDATE shipments 
      SET outbound_id = (SELECT id FROM outbound_batches WHERE internal_tracking = ?),
          status = 3
      WHERE id = ?
    `);

    formData.shipmentIds.forEach(id => {
      statements.push(updateStmt.bind(formData.internal_tracking, id));
    });

    await db.batch(statements);

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}