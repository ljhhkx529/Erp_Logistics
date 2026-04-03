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
  // ✅ OpenNext 正确获取 env（替代 getRequestContext）
  const env = (globalThis as any).process?.env || {};

  try {
    const body = await request.json();
    const { 
      client,
      product,
      valueRmb,
      trackingList,
      warehouse,
      apiKey
    } = body;

    // ✅ API Key 校验
    const EXPECTED_TOKEN = env.API_KEY;
    if (!apiKey || apiKey !== EXPECTED_TOKEN) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid API Key" },
        { status: 403 }
      );
    }

    // ✅ 数据校验
    if (!trackingList || !Array.isArray(trackingList) || trackingList.length === 0) {
      return NextResponse.json(
        { error: "No tracking numbers provided" },
        { status: 400 }
      );
    }

    // ✅ 分摊货值
    const count = trackingList.length;
    const totalValue = parseFloat(valueRmb) || 0;
    const avgValue = count > 0 ? totalValue / count : 0;

    // ❗ OpenNext 下 D1 获取方式（重点）
    const db = (process.env as any).logistics_db;

    if (!db) {
      return NextResponse.json(
        { error: "D1 Database binding missing" },
        { status: 500 }
      );
    }

    let inserted = 0;
    let skipped = 0;

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO shipments 
      (tracking_number, client_name, product_name, value_rmb, warehouse, status) 
      VALUES (?, ?, ?, ?, ?, 0)
    `);

    const batchTasks = trackingList.map((track: string) => {
      return stmt.bind(
        track.trim(),
        client || "TG_BOT",
        product || "Unknown",
        avgValue,
        warehouse || "Guangzhou"
      );
    });

    // ✅ 执行批量写入
    const results = await db.batch(batchTasks);

    for (const r of results) {
      if (r.success) inserted++;
      else skipped++;
    }

    return NextResponse.json({ 
      success: true,
      total_received: count,
      inserted,
      skipped,
      avg_value_per_item: avgValue,
      total_value_recorded: totalValue
    });

  } catch (err: any) {
    console.error("API POST Error:", err.message);

    return NextResponse.json(
      { 
        error: "Server Internal Error", 
        details: err.message 
      },
      { status: 500 }
    );
  }
}