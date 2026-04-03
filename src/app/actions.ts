"use server";

import { revalidatePath } from 'next/cache';

// 注意：不再导入 getRequestContext

export async function getShipmentAction(trackingNumber: string) {
  // 在 OpenNext 中，直接从 process.env 获取 D1 绑定
  // 这里的 logistics_db 必须和你 Cloudflare Pages 后台绑定的 Variable name 一致
  const db = (process.env as any).logistics_db;

  console.log("🔍 正在查询单号:", `[${trackingNumber}]`);

  if (!db) {
    console.error("❌ 数据库绑定未找到，请检查 Cloudflare 后台 Settings -> Functions 的 D1 绑定");
    return { success: false, error: "Database binding missing" };
  }

  try {
    const result = await db.prepare(
      "SELECT * FROM shipments WHERE tracking_number = ?"
    ).bind(trackingNumber.trim()).first();
    
    console.log("📦 数据库返回结果:", result);
    return { success: true, data: result };
  } catch (e: any) {
    console.error("❌ 数据库查询出错:", e.message);
    return { success: false, error: e.message };
  }
}

// 获取所有库存记录
export async function getAllShipmentsAction() {
  // 1. 直接从 process.env 获取 D1 绑定名（必须与 Cloudflare 后台设置一致）
  const db = (process.env as any).logistics_db;

  // 2. 防护：如果没找到数据库绑定，先在日志里报错
  if (!db) {
    console.error("❌ 找不到数据库绑定 logistics_db，请检查 Cloudflare 后台设置");
    return { success: false, error: "数据库连接失败" };
  }

  try {
    // 3. 执行查询
    // 按照创建时间倒序排列，最新的在上面
    const { results } = await db.prepare(
      "SELECT * FROM shipments ORDER BY created_at DESC"
    ).all();
    
    // console.log(`✅ 成功获取 ${results.length} 条记录`);
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
  const { env } = getRequestContext();
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

"use server";

import { revalidatePath } from 'next/cache';

// 注意：不再需要 import { getRequestContext }

export async function createOutboundBatchAction(data: {
  internal_tracking: string;
  package_type: string;
  insurance_type: string; 
  shipment_ids: number[];
}) {
  // 1. 获取 D1 数据库实例
  const db = (process.env as any).logistics_db;
  if (!db) return { success: false, error: "Database not connected" };

  try {
    // 2. 获取选中包裹的总重量
    const placeholders = data.shipment_ids.map(() => "?").join(",");
    const weightResult: any = await db.prepare(
      `SELECT SUM(weight) as total_w FROM shipments WHERE id IN (${placeholders})`
    ).bind(...data.shipment_ids).first();

    const totalWeight = weightResult?.total_w ?? 0;

    // 3. 插入发货批次数据
    // 注意：insurance_type 已经正确映射
    const { lastInsertRowid } = await db.prepare(
      `INSERT INTO outbound_batches (internal_tracking, package_type, insurance_type, total_weight, status) 
       VALUES (?, ?, ?, ?, 1)`
    ).bind(
      data.internal_tracking?.trim() || "N/A", 
      data.package_type || "wrapping", 
      data.insurance_type || "none",    
      totalWeight
    ).run();

    // 4. 批量更新原包裹的状态和关联 ID
    // status = 2 表示已出库/已打包
    await db.prepare(
      `UPDATE shipments SET outbound_id = ?, status = 2 WHERE id IN (${placeholders})`
    ).bind(lastInsertRowid, ...data.shipment_ids).run();

    // 5. 刷新页面缓存，让列表立即显示新状态
    revalidatePath('/warehouse/inventory');
    revalidatePath('/warehouse/outbound'); // 假设你有一个发货记录页

    return { success: true };
  } catch (e: any) {
    // 6. 唯一性约束错误处理 (针对自主单号重复)
    if (e.message.includes("UNIQUE constraint failed")) {
      return { 
        success: false, 
        error: "该自主单号已存在，请换一个新单号！/ Этот номер уже занят!" 
      };
    }
    
    console.error("🔥 [Batch Action Error]:", e.message);
    return { success: false, error: e.message };
  }
}
// src/app/actions.ts

"use server";

import { revalidatePath } from 'next/cache';

// 注意：不再需要 import { getRequestContext }

export async function markInboundAction(data: {
  tracking_number: string;
  photo_base64: string;
  quantity: number;
  client_name?: string;
  product_name?: string;
  warehouse?: string;
  isNew?: boolean; // 标识是否为无预报直接入库
}) {
  // 1. 获取 D1 数据库实例
  const db = (process.env as any).logistics_db;
  if (!db) {
    console.error("❌ 数据库绑定未找到");
    return { success: false, error: "Database connection failed" };
  }

  const cleanTracking = data.tracking_number.trim();

  try {
    if (data.isNew) {
      // 🚀 逻辑 A：无预报直接入库 (INSERT)
      // status = 1 表示“已入库”
      await db.prepare(`
        INSERT INTO shipments (
          tracking_number, 
          client_name, 
          product_name, 
          warehouse, 
          photo_base64, 
          quantity, 
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `)
      .bind(
        cleanTracking,
        data.client_name || "WALK_IN",
        data.product_name || "General Goods",
        data.warehouse || "Guangzhou",
        data.photo_base64,
        data.quantity
      ).run();

      console.log(`✅ 新包裹入库成功: ${cleanTracking}`);
    } else {
      // 🚀 逻辑 B：匹配预报入库 (UPDATE)
      const info = await db.prepare(`
        UPDATE shipments 
        SET status = 1, 
            photo_base64 = ?, 
            quantity = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE tracking_number = ?
      `)
      .bind(data.photo_base64, data.quantity, cleanTracking)
      .run();

      if (info.meta.changes === 0) {
        console.warn(`⚠️ 未找到匹配的预报单号: ${cleanTracking}`);
        return { success: false, error: "未找到该预报单号，请尝试手动录入 / Номер не найден" };
      }
      
      console.log(`✅ 预报包裹更新入库成功: ${cleanTracking}`);
    }

    // 2. 核心：入库成功后，刷新库存列表页和查询页的缓存
    revalidatePath('/warehouse/inventory');
    revalidatePath('/warehouse/inbound');

    return { success: true };
  } catch (e: any) {
    console.error("🔥 [Inbound Action Error]:", e.message);
    
    // 如果单号重复导致的 INSERT 失败处理
    if (e.message.includes("UNIQUE constraint failed")) {
      return { success: false, error: "单号已存在，请勿重复入库 / Этот номер уже существует" };
    }
    
    return { success: false, error: e.message };
  }
}

// src/app/actions.ts

"use server";

import { revalidatePath } from 'next/cache';

// 注意：不再需要 import { getRequestContext }

export async function submitShipmentAction(data: {
  client: string;
  product: string;
  valueRmb: number; // 用户填写的总货值
  trackingList: string[];
  warehouse: string;
  destination: string;
}) {
  // 1. 获取 D1 数据库实例
  const db = (process.env as any).logistics_db;
  if (!db) {
    console.error("❌ 数据库连接失败");
    return { success: false, error: "Database not connected" };
  }

  try {
    // 2. 计算单个包裹的平均货值
    const count = data.trackingList.length;
    if (count === 0) return { success: false, error: "单号列表不能为空" };
    
    const averageValue = data.valueRmb / count;

    // 3. 准备 SQL 语句
    // 注意：status 默认为 0 (预报中)
    const stmt = db.prepare(
      `INSERT INTO shipments (
        tracking_number, 
        client_name, 
        product_name, 
        value_rmb, 
        warehouse, 
        destination, 
        status,
        created_at
      ) 
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
    );

    // 4. 构建批量绑定任务
    const batch = data.trackingList
      .filter(track => track.trim() !== "") // 过滤掉空行
      .map(track => 
        stmt.bind(
          track.trim(), 
          data.client, 
          data.product, 
          averageValue, 
          data.warehouse,
          data.destination
        )
      );
    
    // 5. 执行 D1 批量事务处理 (高性能)
    await db.batch(batch);

    console.log(`✅ 成功预报 ${count} 个包裹`);

    // 6. 刷新相关页面缓存
    revalidatePath('/warehouse/inventory');
    // 如果你有用户端的包裹列表页，也建议刷新
    // revalidatePath('/customer/shipments');

    return { success: true, count: count };
  } catch (e: any) {
    console.error("🔥 [Submit Action Error]:", e.message);

    // 针对单号重复的报错处理
    if (e.message.includes("UNIQUE constraint failed")) {
      return { 
        success: false, 
        error: "提交失败：单号列表中包含已存在的单号，请检查 / Некоторые номера уже существуют" 
      };
    }

    return { success: false, error: e.message };
  }
}