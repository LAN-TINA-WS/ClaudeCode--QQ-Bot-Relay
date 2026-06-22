/**
 * QQ Bot Relay - 安装配置助手 / Setup Assistant
 *
 * 用法 / Usage:
 *   node setup.js                安装向导（推荐 / recommended）
 *   node setup.js check          验证配置 / verify config
 *   node setup.js capture-id     捕获 openID
 *   node setup.js show-id        查看已保存的 openID
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { createInterface } from "readline";
import { execSync } from "child_process";

const APP_VERSION = "1.1.0";

// ============================================================
// 工具
// ============================================================

function readLine(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function readExistingEnv(key) {
  if (!existsSync(".env")) return "";
  const content = readFileSync(".env", "utf-8");
  const m = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

/** 彻底断开 QQClient，阻止自动重连 */
function forceDisconnect(qq) {
  qq._scheduleReconnect = () => {};
  if (qq.reconnectTimer) clearTimeout(qq.reconnectTimer);
  if (qq.heartbeatTimer) clearInterval(qq.heartbeatTimer);
  if (qq.ws) {
    qq.ws.removeAllListeners("close");
    qq.ws.removeAllListeners("error");
    qq.ws.close();
    qq.ws = null;
  }
  qq.connected = false;
}

/** 等待用户按任意键 */
function pressAnyKey(msg) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg || "按任意键退出 / Press any key to exit...", () => {
      rl.close();
      resolve();
    });
  });
}

// ============================================================
// 交互式安装向导
// ============================================================

async function runSetup() {
  console.log("================================================");
  console.log("   QQ Bot Relay - 安装配置向导 / Setup Wizard");
  console.log("================================================\n");

  // ---- Step 0: 环境检查 ----
  console.log("--- Step 0: 环境检查 / Environment Check ---");
  console.log("Node.js:", process.version, "\n");

  // 检查 / 安装依赖
  if (!existsSync("node_modules/ws")) {
    console.log("[..] 安装 npm 依赖 / Installing npm dependencies...");
    try {
      execSync("npm i", { stdio: "inherit", cwd: "." });
      console.log("[OK] 依赖安装完成 / Dependencies installed\n");
    } catch (e) {
      console.error("[ERR] npm install 失败 / failed:", e.message);
      await pressAnyKey();
      process.exit(1);
    }
  } else {
    console.log("[OK] npm 依赖已就绪 / Dependencies ready\n");
  }

  // ---- Step 0.5: Claude Code 位置 ----
  console.log("--- Step 0.5: Claude Code 位置 / Claude Code Location ---\n");

  const currentClaudeDir = readExistingEnv("CLAUDE_CODE_DIR") || "D:\\Deploy\\Claude Code";
  const claudeDirPrompt = `  Claude Code 目录路径 / Directory path [${currentClaudeDir}]
  （留空不变 / leave blank to keep）: `;
  const claudeDir = await readLine(claudeDirPrompt);
  const finalClaudeDir = (claudeDir || currentClaudeDir).replace(/\/$/, "").replace(/\\$/, "");

  if (finalClaudeDir) {
    // 验证目录是否存在
    try {
      const stat = await import("fs").then((fs) => fs.statSync(finalClaudeDir));
      if (!stat.isDirectory()) {
        console.warn("  [WARN] 路径存在但不是目录 / Path exists but is not a directory\n");
      }
    } catch {
      console.warn("  [WARN] 目录不存在，将使用该路径 / Directory not found, will use it anyway\n");
    }
  }

  console.log("");

  // ---- Step 1: QQ 凭证 ----
  console.log("--- Step 1: QQ Bot 凭证 / Credentials ---");
  console.log("（从 https://bots.qq.com 获取 / Get from bots.qq.com）\n");

  const currentId = readExistingEnv("QQ_APP_ID");
  const currentSecret = readExistingEnv("QQ_APP_SECRET");

  const appId = await readLine(
    currentId
      ? `  QQ_APP_ID [${currentId}]（留空不变 / leave blank to keep）: `
      : "  QQ_APP_ID: "
  );
  const finalAppId = appId || currentId;
  if (!finalAppId) {
    console.error("[ERR] QQ_APP_ID 不能为空 / is required");
    await pressAnyKey();
    process.exit(1);
  }

  const appSecret = await readLine(
    currentSecret
      ? `  QQ_APP_SECRET [${currentSecret.slice(0, 4)}****]（留空不变 / leave blank to keep）: `
      : "  QQ_APP_SECRET: "
  );
  const finalAppSecret = appSecret || currentSecret;
  if (!finalAppSecret) {
    console.error("[ERR] QQ_APP_SECRET 不能为空 / is required");
    await pressAnyKey();
    process.exit(1);
  }

  // 写入 .env
  const envContent = [
    "# QQ Bot Credentials",
    `QQ_APP_ID=${finalAppId}`,
    `QQ_APP_SECRET=${finalAppSecret}`,
    "",
    "# Claude Code configuration",
    `CLAUDE_CODE_DIR=${finalClaudeDir}`,
    "# Claude Code model hint (optional)",
    "CLAUDE_MODEL=deepseek-v4-flash",
    "",
  ].join("\n");
  writeFileSync(".env", envContent, "utf-8");
  console.log("[OK] .env 已保存 / saved");
  console.log("     CLAUDE_CODE_DIR:", finalClaudeDir, "\n");

  // ---- Step 2: 测试连接 ----
  console.log("--- Step 2: 测试连接 / Test Connection ---");
  console.log("（可选 / optional - 验证凭证是否正确 / verify credentials）\n");

  const doTest = (await readLine("测试连接？/ Test connection? [Y/n]: ")).toLowerCase();
  if (doTest !== "n" && doTest !== "no") {
    await testConnection();
  } else {
    console.log("已跳过 / Skipped\n");
  }

  // ---- Step 3: 捕获 openID ----
  console.log("--- Step 3: 获取用户 openID / Capture Your User ID ---");
  console.log("（向机器人发一条私聊消息即可获取 / Send a private message to the bot）\n");

  const doCapture = (await readLine("获取你的 openID？/ Capture now? [Y/n]: ")).toLowerCase();
  if (doCapture !== "n" && doCapture !== "no") {
    await captureUserId();
  } else {
    console.log("已跳过 / Skipped\n");
  }

  // ---- 完成 ----
  console.log("================================================");
  console.log("  配置完成！ / Setup Complete！");
  console.log("  启动 Bot:  npm start");
  console.log("  或双击 / Or double-click:  start.bat");
  console.log("================================================");
  await pressAnyKey();
}

// ============================================================
// 检查配置
// ============================================================

function checkConfig() {
  console.log("=== 配置检查 / Configuration Check ===\n");

  if (!existsSync(".env")) {
    console.log("[FAIL] .env 不存在。请运行: node setup.js");
    console.log("      .env not found. Run: node setup.js");
    process.exit(1);
  }

  const env = readFileSync(".env", "utf-8");
  const idMatch = env.match(/^QQ_APP_ID=(.+)$/m);
  const secretMatch = env.match(/^QQ_APP_SECRET=(.+)$/m);

  if (!idMatch || !idMatch[1]) {
    console.log("[FAIL] QQ_APP_ID 未配置 / not configured");
    process.exit(1);
  }
  if (!secretMatch || !secretMatch[1]) {
    console.log("[FAIL] QQ_APP_SECRET 未配置 / not configured");
    process.exit(1);
  }
  console.log("[OK] QQ_APP_ID:", idMatch[1]);
  console.log("     QQ_APP_SECRET:", secretMatch[1].slice(0, 4) + "****");

  console.log("[OK] Node.js:", process.version);

  if (!existsSync("node_modules/ws")) {
    console.log("[FAIL] npm 依赖未安装，运行: npm i");
    console.log("      Dependencies not installed. Run: npm i");
    process.exit(1);
  }
  console.log("[OK] npm 依赖已安装 / Dependencies installed");

  // 检查 CLAUDE_CODE_DIR
  const claudeDirMatch = env.match(/^CLAUDE_CODE_DIR=(.*)$/m);
  if (claudeDirMatch && claudeDirMatch[1]) {
    const dir = claudeDirMatch[1].trim();
    try {
      const stat = statSync(dir);
      if (stat.isDirectory()) {
        console.log("[OK] CLAUDE_CODE_DIR:", dir);
      } else {
        console.log("[WARN] CLAUDE_CODE_DIR 存在但不是目录:", dir);
      }
    } catch {
      console.log("[WARN] CLAUDE_CODE_DIR 目录不存在:", dir);
      console.log("       运行 setup 重新配置 / Run setup to reconfigure");
    }
  } else {
    console.log("[WARN] CLAUDE_CODE_DIR 未配置 / not configured");
    console.log("       运行 setup 重新配置 / Run setup to reconfigure");
  }
  console.log("");

  if (existsSync("config.json")) {
    const cfg = JSON.parse(readFileSync("config.json", "utf-8"));
    if (cfg.userOpenId) {
      console.log("[INFO] 私聊 openID:", cfg.userOpenId);
    }
    if (cfg.allGroupOpenIds && cfg.allGroupOpenIds.length > 0) {
      cfg.allGroupOpenIds.forEach((g) => {
        console.log("       群 / Group %s -> openID: %s", g.group_id, g.member_openid);
      });
    }
  }

  console.log("\n[OK] 一切就绪！运行 / Run: npm start");
}

// ============================================================
// 测试连接
// ============================================================

async function testConnection() {
  console.log("正在连接 QQ... / Connecting to QQ...\n");

  const { QQClient } = await import("./src/qq-client.js");
  const qq = new QQClient();

  const timeout = setTimeout(() => {
    console.log("\n[TIMEOUT] 连接超时 / Connection timeout\n");
    forceDisconnect(qq);
  }, 15000);

  return new Promise((resolve) => {
    const origConnect = qq.connect.bind(qq);
    qq.connect = async () => {
      try {
        await origConnect();
        const checkReady = setInterval(() => {
          if (qq.connected && qq.ws && qq.ws.readyState === 1) {
            clearTimeout(timeout);
            clearInterval(checkReady);
            console.log("[OK] QQ 连接成功 / Connected successfully!\n");
            forceDisconnect(qq);
            resolve(true);
          }
        }, 500);
        setTimeout(() => clearInterval(checkReady), 16000);
      } catch (err) {
        clearTimeout(timeout);
        console.error("[FAIL] 连接失败 / Connection failed:", err.message, "\n");
        resolve(false);
      }
    };
    qq.connect().catch(() => resolve(false));
  });
}

// ============================================================
// 捕获 openID
// ============================================================

async function captureUserId() {
  if (!existsSync(".env")) {
    console.error("[ERR] 请先配置 .env / Configure .env first. 运行: node setup.js");
    await pressAnyKey();
    process.exit(1);
  }

  console.log("正在连接 QQ... / Connecting to QQ...\n");
  console.log("请向机器人发送一条私聊消息（或群聊 @它）");
  console.log("Send a private message to the bot (or @ it in a group):\n");

  let { QQClient } = await import("./src/qq-client.js");
  const qq = new QQClient();

  const timeout = setTimeout(() => {
    console.log("\n[TIMEOUT] 15 秒内未收到消息 / No message received");
    console.log("稍后重试: node setup.js capture-id / Try again later\n");
    forceDisconnect(qq);
    process.exit(1);
  }, 15000);

  qq.onMessage((msg) => {
    clearTimeout(timeout);

    console.log("\n[收到消息 / Message Received!]");
    console.log("  内容 / Content:", msg.content);

    const cfgPath = "config.json";
    const config = existsSync(cfgPath)
      ? JSON.parse(readFileSync(cfgPath, "utf-8"))
      : {};

    if (msg.type === "private") {
      console.log("  类型 / Type: 私聊 / Private chat");
      console.log("  你的 openID:", msg.openid);

      config.userOpenId = msg.openid;
      config.capturedAt = new Date().toISOString();
      if (!config.allOpenIds) config.allOpenIds = [];
      if (!config.allOpenIds.includes(msg.openid)) config.allOpenIds.push(msg.openid);

      writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf-8");
      console.log("\n[OK] openID 已保存到 config.json / saved to config.json");

    } else if (msg.type === "group") {
      console.log("  类型 / Type: 群聊 / Group @");
      console.log("  群 ID / Group ID:", msg.group_id);
      console.log("  你的成员 openID / Member openID:", msg.openid);

      if (!config.allGroupOpenIds) config.allGroupOpenIds = [];
      if (!config.allGroupOpenIds.some((g) => g.group_id === msg.group_id)) {
        config.allGroupOpenIds.push({ group_id: msg.group_id, member_openid: msg.openid, capturedAt: new Date().toISOString() });
      }

      writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf-8");
      console.log("\n[OK] 群信息已保存 / Group info saved to config.json");
    }

    console.log("\n3 秒后断开 / Disconnecting in 3s...");
    setTimeout(() => {
      forceDisconnect(qq);
      console.log("完成！/ Done!");
      process.exit(0);
    }, 3000);
  });

  try {
    await qq.connect();
    console.log("已连接，等待消息... / Connected! Waiting for your message...");
  } catch (err) {
    clearTimeout(timeout);
    console.error("\n[ERR] 连接失败 / Connection failed:", err.message);
    console.log("可能的原因 / Possible causes:");
    console.log("  - QQ_APP_ID / Secret 错误 / wrong credentials");
    console.log("  - 网络问题 / network issue");
    console.log("  - Bot 未审核通过 / Bot not approved\n");
    await pressAnyKey();
    process.exit(1);
  }
}

// ============================================================
// 显示已保存的 openID
// ============================================================

function showSavedId() {
  if (!existsSync("config.json")) {
    console.log("[INFO] 尚无保存的用户信息 / No saved user info yet");
    console.log("运行 / Run: node setup.js capture-id\n");
    return;
  }

  const config = JSON.parse(readFileSync("config.json", "utf-8"));
  console.log("=== 已保存的用户信息 / Saved User Info ===\n");

  if (config.userOpenId) {
    console.log("私聊 openID:", config.userOpenId);
    console.log("捕获时间 / Captured at:", config.capturedAt, "\n");
  }

  if (config.allOpenIds && config.allOpenIds.length > 0) {
    console.log("所有私聊 openID / All private IDs:");
    config.allOpenIds.forEach((id, i) => console.log("  %d. %s", i + 1, id));
    console.log();
  }

  if (config.allGroupOpenIds && config.allGroupOpenIds.length > 0) {
    console.log("群聊信息 / Group memberships:");
    config.allGroupOpenIds.forEach((g, i) => {
      console.log("  %d. 群 / Group %s -> %s", i + 1, g.group_id, g.member_openid);
    });
    console.log();
  }

  if (!config.userOpenId && (!config.allOpenIds || config.allOpenIds.length === 0)) {
    console.log("(config.json 存在但无 openID 记录 / exists but no openID)\n");
  }
}

// ============================================================
// 入口
// ============================================================

const mode = process.argv[2] || "setup";

switch (mode) {
  case "setup":
    runSetup().catch(async (err) => {
      console.error("\n[ERR]", err.message);
      await pressAnyKey();
      process.exit(1);
    });
    break;
  case "check":
    checkConfig();
    break;
  case "capture-id":
    captureUserId().catch(async (err) => {
      console.error("\n[ERR]", err.message);
      await pressAnyKey();
      process.exit(1);
    });
    break;
  case "show-id":
    showSavedId();
    break;
  default:
    console.log(`
QQ Bot Relay 配置助手 / Setup Tool v${APP_VERSION}

用法 / Usage:
  node setup.js               安装向导 / Setup wizard（推荐）
  node setup.js check         验证配置 / Verify config
  node setup.js capture-id    捕获 openID / Capture your openID
  node setup.js show-id       查看已保存信息 / Show saved user info
`);
    break;
}
