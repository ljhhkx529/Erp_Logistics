import { NextResponse } from "next/server";

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

/**
 * POST 方法：处理批量入库
 */
export async function POST(request: Request) {
  // 1. 从 process.env 获取环境变量 (OpenNext 规范)
  const env = process.env as any;
  
  // 🚀 三重保险获取数据库对象
  const db = env.logistics_db || globalThis.logistics_db || env.LOGISTICS_DB;

  try {
    const body = await request.json();
    const { client, product, valueRmb, trackingList, warehouse, apiKey } = body;

    // 2. 校验 API Key (确认为 076311)
    if (!apiKey || apiKey !== env.API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 3. 如果还是找不到数据库，打印出当前所有可用的 Key 帮助我们最后定位
    if (!db) {
      return NextResponse.json({ 
        error: "D1 Database binding missing", 
        debug: {
          available_env_keys: Object.keys(env),
          looking_for: "logistics_db"
        }
      }, { status: 500 });
    }

    // --- 以下是正常的写入逻辑 ---
    const count = trackingList.length;
    const avgValue = (parseFloat(valueRmb) || 0) / (count || 1);

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO shipments 
      (tracking_number, client_name, product_name, value_rmb, warehouse, status) 
      VALUES (?, ?, ?, ?, ?, 0)
    `);

    const batchTasks = trackingList.map((track: string) => 
      stmt.bind(track.trim(), client, product, avgValue, warehouse)
    );

    await db.batch(batchTasks);

    return NextResponse.json({ success: true, inserted: count });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}