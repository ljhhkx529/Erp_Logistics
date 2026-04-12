"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1Database } from "@cloudflare/workers-types";
// 定义你自己数据库的形状
interface MyCustomEnv {
  logistics_db: D1Database;
  // 如果还有别的环境变量也可以写在这
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