import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1Database } from "@cloudflare/workers-types";



interface MyCustomEnv {
  logistics_db: D1Database;
  API_KEY: string;
  // 如果还有别的环境变量也可以写在这
}
/**
 * GET 方法：仅用于基础连通性测试
 * 访问地址: http://localhost:8788/api/shipments
 */
export async function GET() {
  return NextResponse.json({ 
    status: "online", 
    message: "ERP API Gateway is active!",
    version: "3.0.1" 
  });
}

/**
 * POST 方法：处理来自 TG 机器人或外部系统的批量入库
 */
export async function POST(request: Request) {
  // 1. 获取 Cloudflare 环境上下文 (D1 数据库和环境变量)
  const { env } = getCloudflareContext() as unknown as { env: MyCustomEnv };

  // 🛡️ 防御性检查：如果没有 env，说明没通过 Wrangler 8788 端口访问
  if (!env) {
    return NextResponse.json({ 
      error: "Cloudflare Environment not found. Please use port 8788 for testing." 
    }, { status: 500 });
  }

  try {
    // 2. 解析请求体
    const body = await request.json();
    const { 
      client,       // 客户名 (如 Archi)
      product,      // 货物名 (如 衣服)
      valueRmb,
      quantity,     // 总货值 (如 2400)
      trackingList, // 单号数组 (如 ["SF1", "SF2"])
      whCode,
      destCode, 
      photo_base64, 
      apiKey,        // 验证令牌
    } = body;

    // 3. 安全校验：比对环境变量中的 API_KEY
    const EXPECTED_TOKEN = env.API_KEY; 
    if (!apiKey || apiKey !== EXPECTED_TOKEN) {
      return NextResponse.json({ error: "Unauthorized: Invalid API Key" }, { status: 403 });
    }

    // 4. 数据基础校验
    if (!trackingList || !Array.isArray(trackingList) || trackingList.length === 0) {
      return NextResponse.json({ error: "No tracking numbers provided" }, { status: 400 });
    }

    // 5. 核心逻辑：分摊货值 (修复 SF1+SF2 翻倍 Bug)
    // 逻辑：总价值 / 包裹数量 = 每个包裹记录的平均价值
    const count = trackingList.length;
    const totalValue = parseFloat(valueRmb) || 0;
    const avgValue = count > 0 ? totalValue / count : 0;
    const warehouse = whCode === "1" ? "Guangzhou" : (whCode === "2" ? "Ny" : "Other");
    const destination = destCode === "1" ? "Москве" : (destCode === "2" ? "Almaty" : "Other");

    // 6. 自动识别数据库绑定名 (兼容不同配置)
    const db = env.logistics_db;
    if (!db) {
      return NextResponse.json({ error: "D1 Database binding missing" }, { status: 500 });
    }

        let inserted = 0;
        let skipped = 0;

    const stmt = db.prepare(`
      INSERT INTO shipments 
      (tracking_number, client_name, product_name, value_rmb, warehouse, destination, photo_base64, quantity, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tracking_number) DO UPDATE SET
        photo_base64 = COALESCE(excluded.photo_base64, photo_base64),
        quantity = COALESCE(excluded.quantity, quantity),
        status = 1, -- 只要通过这个验货接口更新，状态就自动转为“已入库”
        client_name = CASE WHEN excluded.client_name != 'iOS_SHORTCUT' THEN excluded.client_name ELSE client_name END
    `);

    const isInbound = !!photo_base64;

        const batchTasks = trackingList.map((track: string) => {
      return stmt.bind(
        track.trim(),
        client || "iOS_SHORTCUT",
        product || "General Goods",
        avgValue,
        parseInt(quantity) || 1,
        warehouse || "Guangzhou",
        destination || "Unknown",
        photo_base64 || null,
        isInbound ? 1 : 0
      );
    });

        // 执行批量写入
        const results = await db.batch(batchTasks);

        // 统计结果（D1 会返回 success 状态）
        for (const r of results) {
        if (r.success) {
            inserted++;
        } else {
            skipped++;
        }
        }

    // 🚀 执行原子化批量写入
    await db.batch(batchTasks);

    // 8. 返回成功响应
    return NextResponse.json({ 
        success: true,
        total_received: count,
        inserted,
        skipped,
        avg_value_per_item: avgValue,
        total_value_recorded: totalValue
        });

  } catch (err: unknown) {
    console.error("API POST Error:", (err as Error).message);
    // 处理 JSON 解析失败或数据库唯一约束冲突 (UNIQUE constraint)
    return NextResponse.json({ 
      error: "Server Internal Error", 
      details: (err as Error).message 
    }, { status: 500 });
  }
}