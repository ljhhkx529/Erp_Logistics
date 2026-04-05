// src/app/api/bot/route.ts

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  
  try {
    const update = await request.json(); // 拿到 TG 发来的消息
    const messageText = update.message?.text;
    const chatId = update.message?.chat.id;

    if (!messageText) return new Response("OK");

    // 1. 🚀 解析逻辑 (假设格式：客户 品名 金额 单号)
    const [client, product, value, tracking] = messageText.split(/\s+/);

    // 2. 🚀 直接 fetch 你自己写好的接口
    // 注意：在 Cloudflare 环境下，建议使用完整的 URL 或直接调用本地逻辑
    const apiResponse = await fetch("https://erplogistics.ljhzyx520.workers.dev/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: '076311', // 从环境变量拿之前设定的那个 Key
        client: client,
        product: product,
        valueRmb: value,
        trackingList: [tracking],
        warehouse: "Guangzhou"
      })
    });

    const result = await apiResponse.json();

    // 3. 🚀 把结果回传给 TG 里的用户
    if (result.success) {
      await sendToTg(chatId, `✅ 录入成功！单号: ${tracking}`);
    } else {
      await sendToTg(chatId, `❌ 录入失败: ${result.error}`);
    }

    return new Response("OK");
  } catch (err) {
    return new Response("OK"); // 保证给 TG 一个回应
  }
}

// 辅助函数：发消息给机器人用户
async function sendToTg(chatId: number, text: string) {
  const token = "8783430378:AAEwa4EdUz-6CMa2IaiEWaRTUwIDl0oH4hQ"; 
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });
}