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
  // 1. 获取 Cloudflare 官方上下文
  const { env } = getRequestContext();

  // 🛡️ 环境校验
  if (!env || !env.logistics_db) {
    return NextResponse.json(
      { error: "D1 Database binding 'logistics_db' not found." },
      { status: 500 }
    );
  }

  const db = env.logistics_db;

  try {
    // 2. 解析并验证请求体
    const body = await request.json();
    const { 
      client, 
      product, 
      valueRmb, 
      trackingList, 
      warehouse, 
      apiKey 
    } = body;

    // 3. 安全校验：使用 env 中的变量
    if (!apiKey || apiKey !== env.API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!Array.isArray(trackingList) || trackingList.length === 0) {
      return NextResponse.json({ error: "Empty tracking list" }, { status: 400 });
    }

    // 4. 逻辑计算：分摊货值
    const count = trackingList.length;
    const totalValue = parseFloat(valueRmb) || 0;
    const avgValue = totalValue / count;

    // 5. 准备批量任务
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO shipments 
      (tracking_number, client_name, product_name, value_rmb, warehouse, status, created_at) 
      VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);

    const batchTasks = trackingList.map((track: string) => 
      stmt.bind(
        track.trim(),
        client || "API_BOT",
        product || "General",
        avgValue,
        warehouse || "Guangzhou"
      )
    );

    // 6. 执行原子化批量写入 (只执行一次！)
    const results = await db.batch(batchTasks);

    // 7. 精准统计：D1 的 meta.changes 会告诉你真正写入了多少行
    let insertedCount = 0;
    results.forEach((r) => {
      insertedCount += r.meta.changes;
    });

    const skippedCount = count - insertedCount;

    // 8. 返回符合逻辑的响应
    return NextResponse.json({ 
      success: true,
      meta: {
        total_received: count,
        inserted: insertedCount,    // 真正新入库的数量
        skipped: skippedCount,      // 因为单号重复被跳过的数量
        avg_value: avgValue
      }
    });

  } catch (err: any) {
    console.error("D1 Batch Error:", err.message);
    return NextResponse.json(
      { error: "Database Operation Failed", details: err.message },
      { status: 500 }
    );
  }
}