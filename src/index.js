import { QQClient } from "./qq-client.js";
import { AgentClient } from "./agent-client.js";

// ========== 去重缓存 ==========
const recentIds = new Set();
const DEDUP_WINDOW = 30000;

function isDuplicate(msg) {
  const key = msg.id || `${msg.openid}:${msg.content}:${msg.timestamp}`;
  if (recentIds.has(key)) return true;
  recentIds.add(key);
  setTimeout(() => recentIds.delete(key), DEDUP_WINDOW);
  return false;
}

// ========== 消息处理（串行） ==========
const pendingQueue = [];
let processing = false;

async function processQueue(qq, agent) {
  if (processing || pendingQueue.length === 0) return;
  processing = true;

  const msg = pendingQueue.shift();

  try {
    console.log(`[Relay] 处理: ${msg.content.slice(0, 50)}`);

    // 调用 Claude Code 获取回复
    const reply = await agent.getReply(msg);

    if (reply) {
      // 成功：直接发回复
      if (msg.type === "group") {
        await qq.sendGroupMessage(msg.group_id, reply);
      } else {
        await qq.sendPrivateMessage(msg.openid, reply);
      }
      console.log("[Relay] 回复已发送");
    } else {
      // 失败：通知用户
      console.log("[Relay] AI 处理失败，通知用户");
      const errMsg = "暂时无法回复，请稍后再试。";
      if (msg.type === "group") {
        await qq.sendGroupMessage(msg.group_id, errMsg);
      } else {
        await qq.sendPrivateMessage(msg.openid, errMsg);
      }
    }

  } catch (err) {
    console.error("[Relay] 处理异常:", err.message);
  } finally {
    processing = false;
    processQueue(qq, agent);
  }
}

function enqueueMessage(msg, qq, agent) {
  if (isDuplicate(msg)) return;
  console.log(`[Relay] 入队: [${msg.type}] ${msg.openid}: ${msg.content.slice(0, 50)}`);
  pendingQueue.push(msg);
  processQueue(qq, agent);
}

// ========== 主入口 ==========

async function main() {
  console.log("=".repeat(50));
  console.log("  QQ Bot Relay - Agent: Claude Code");
  console.log("=".repeat(50));

  const qq = new QQClient();
  const agent = new AgentClient();

  qq.onMessage((msg) => {
    enqueueMessage(msg, qq, agent);
  });

  await qq.connect();

  console.log("-".repeat(50));
  console.log("  等待 QQ 消息中...");
  console.log("  (收到消息 -> claude -p -> 回复)");
  console.log("-".repeat(50));
}

process.on("SIGINT", () => { console.log("\n[Relay] 关闭"); process.exit(0); });
process.on("SIGTERM", () => { console.log("\n[Relay] 关闭"); process.exit(0); });

main().catch((err) => {
  console.error("[Relay] 启动失败:", err);
  process.exit(1);
});
