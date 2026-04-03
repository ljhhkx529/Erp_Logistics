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
  // 1. 获取环境上下文
  // 在 OpenNext 下，Bindings 有时直接挂在 globalThis 上，有时在 process.env
  const env = process.env as any;
  
  /**
   * 🚀 寻找 D1 的三板斧：
   * 1. 尝试直接引用（即使不在 Object.keys 里，也可能存在）
   * 2. 尝试从 globalThis 获取（Cloudflare 原生注入点）
   * 3. 尝试从 OpenNext 的私有环境对象获取
   */
  const db = env.logistics_db || (globalThis as any).logistics_db || (globalThis as any).__env__?.logistics_db;

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

    // 2. 校验 API Key (确认为你的 076311)
    if (!apiKey || apiKey !== env.API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 3. 严格校验数据库对象
    if (!db || typeof db.prepare !== 'function') {
      return NextResponse.json({ 
        error: "D1 Database binding missing",
        debug: {
          msg: "在所有路径下均未找到 D1 对象 / Объект D1 не найден",
          // 这里的检查不再看 key 列表，而是看直接引用的类型
          type_in_env: typeof env.logistics_db,
          type_in_global: typeof (globalThis as any).logistics_db,
          available_vars: Object.keys(env)
        }
      }, { status: 500 });
    }

    // 4. 数据预处理
    if (!trackingList || !Array.isArray(trackingList)) {
      return NextResponse.json({ error: "Invalid tracking list" }, { status: 400 });
    }

    const count = trackingList.length;
    const totalValue = parseFloat(valueRmb) || 0;
    const avgValue = count > 0 ? totalValue / count : 0;

    // 5. 准备 SQL 并执行批量写入
    // 使用 INSERT OR IGNORE 防止重复单号导致整个 Batch 崩溃
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO shipments 
      (tracking_number, client_name, product_name, value_rmb, warehouse, status, created_at) 
      VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);

    const batchTasks = trackingList.map((track: string) => {
      return stmt.bind(
        track.trim(),
        client || "API_BOT",
        product || "General",
        avgValue,
        warehouse || "Guangzhou"
      );
    });

    await db.batch(batchTasks);

    return NextResponse.json({ 
      success: true,
      inserted_count: count,
      avg_value: avgValue
    });

  } catch (err: any) {
    console.error("API Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}