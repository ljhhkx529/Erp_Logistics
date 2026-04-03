import { NextResponse } from "next/server";
// 🚀 注意：这是 OpenNext 1.x 版本的标准写法
import { getRequestContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";
/**
 * GET 方法：仅用于基础连通性测试
 */
export async function GET() {
  return NextResponse.json({ 
    status: "online", 
    message: "ERP API Gateway is active!",
    version: "3.0.1" 
  });
}

export async function POST(request: Request) {
  try {
    // 1. 拿到真正的 Cloudflare 环境对象
    const ctx = getRequestContext();
    
    // 2. 从 ctx.env 中提取数据库
    // 这里的 logistics_db 必须和 wrangler.toml 里的 binding 一致
    const db = ctx.env.logistics_db;

    // 诊断检查（如果还是报错，看这个 debug 信息）
    if (!db) {
      return NextResponse.json({ 
        error: "D1 Binding Missing",
        debug: {
          msg: "在 RequestContext 中未找到数据库",
          available_bindings: Object.keys(ctx.env || {}) 
        }
      }, { status: 500 });
    }

    const body = await request.json();
    const { client, product, valueRmb, trackingList, warehouse, apiKey } = body;

    // 3. 校验 API Key (可以从 ctx.env 拿，它是最原始的配置)
    if (!apiKey || apiKey !== ctx.env.API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 4. 批量写入逻辑
    const count = trackingList.length;
    const avgValue = (parseFloat(valueRmb) || 0) / (count || 1);

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO shipments 
      (tracking_number, client_name, product_name, value_rmb, warehouse, status, created_at) 
      VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);

    const batchTasks = trackingList.map((track: string) => 
      stmt.bind(track.trim(), client, product, avgValue, warehouse)
    );

    await db.batch(batchTasks);

    return NextResponse.json({ success: true, count });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}