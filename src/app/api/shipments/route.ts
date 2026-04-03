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
  // 🚀 官方获取方式
  // 注意：这个方法只能在 runtime = "edge" 时正常工作
  const { env } = getRequestContext();
  const db = env.logistics_db;

  if (!db) {
    return NextResponse.json({ error: "D1 插座未连接 / D1 не подключен" }, { status: 500 });
  }
  
  try {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO shipments 
    (tracking_number, client_name, product_name, value_rmb, warehouse, status, created_at) 
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `);

  const batchTasks = trackingList.map((track: string) => 
    stmt.bind(track.trim(), client, product, avgValue, warehouse)
  );

  // 🚀 重点 1：必须 await，并接收结果
  const results = await db.batch(batchTasks);
  
  // 🚀 重点 2：打印结果元数据（这能告诉你到底写进去了几行）
  const totalChanges = results.reduce((acc: number, r: any) => acc + (r.meta?.changes || 0), 0);
  console.log(`📊 D1 执行完毕，实际写入行数: ${totalChanges}`);

  if (totalChanges === 0) {
     return NextResponse.json({ 
       success: true, 
       msg: "执行成功但未写入新数据（可能是单号已存在）",
       details: results.map((r: any) => r.meta)
     });
  }

  return NextResponse.json({ success: true, inserted: totalChanges });

} catch (err: any) {
  // 如果这里没报错，说明 SQL 语法是对的
  return NextResponse.json({ error: err.message }, { status: 500 });
}