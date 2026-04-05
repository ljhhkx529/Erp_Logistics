export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const update = await request.json();
    const message = update.message;
    if (!message || !message.text) return new Response("OK");

    const messageText = message.text.trim();
    const chatId = message.chat.id;

    // --- 1. 处理 /start：发送文字模板 ---
    if (messageText.startsWith("/start")) {
      const template = `📦 **物流报备模板 / ШАБЛОН**
请复制下方格式并修改发送：

\`/report 单号/客户/物品/货物价值/仓库编号/目的地编号\`

🔢 **编号说明 / Описание:**
🏢 **仓库 (WH):** 1-Guangzhou, 2-Ny
📍 **目的地 (Dest):** 1-Москве, 2-Almaty

**示例 / Пример:**
\`/report SF12345/张三/衣服/500/1/1\``;

      await sendToTg(chatId, template);
      return new Response("OK");
    }

    // --- 2. 处理 /report：解析斜杠数据 ---
    if (messageText.startsWith("/report")) {
      // 去掉指令前缀，按斜杠拆分并去除空格
      const rawData = messageText.replace("/report", "").trim();
      const parts = rawData.split("/").map(p => p.trim());

      // 校验字段数量 (单号/客户/物品/价值/仓库/目的地)
      if (parts.length < 6) {
        await sendToTg(chatId, "⚠️ 格式错误！请确保包含 6 个部分。\n单号/客户/物品/价值/仓库/目的地");
        return new Response("OK");
      }

      const [tracking, client, product, value, whCode, destCode] = parts;

      // 仓库与目的地映射逻辑
      const warehouse = whCode === "1" ? "Guangzhou" : (whCode === "2" ? "Ny" : "Other");
      const destination = destCode === "1" ? "Москве" : (destCode === "2" ? "Almaty" : "Other");

      // 🚀 调用你的 API
      const apiResponse = await fetch("https://erplogistics.ljhzyx520.workers.dev/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: '076311', // 硬编码 API Key
          client: client,
          product: product,
          valueRmb: parseFloat(value) || 0,
          trackingList: [tracking],
          warehouse: warehouse,
          destination: destination 
        })
      });

      const result = await apiResponse.json() as { success: boolean; error?: string };

      if (result.success) {
        await sendToTg(chatId, `✅ 录入成功！\n🚢 单号: ${tracking}\n🏢 仓库: ${warehouse}\n📍 目的地: ${destination}`);
      } else {
        await sendToTg(chatId, `❌ 录入失败: ${result.error}`);
      }
    }

    return new Response("OK");
  } catch {
    // 发生任何解析错误，给 TG 返回 200 防止循环重试
    return new Response("OK");
  }
}

// 辅助函数：发送消息给机器人用户
async function sendToTg(chatId: number, text: string) {
  const token = "8783430378:AAEwa4EdUz-6CMa2IaiEWaRTUwIDl0oH4hQ"; 
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: text,
        parse_mode: "Markdown" 
      }),
    });
  } catch (e) {
    console.error("TG Send Error:", e);
  }
}