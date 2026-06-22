import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import "dotenv/config";

/**
 * AgentClient - 通过 claude -p 子进程接入 Claude Code 作为 AI Agent
 *
 * 每条对话保留最近 6 条历史记录，随新消息一起喂给 Claude Code，
 * 实现上下文连贯的多轮对话。
 */
export class AgentClient {
  constructor() {
    this.claudePath = process.env.CLAUDE_CODE_DIR
      ? process.env.CLAUDE_CODE_DIR.replace(/\\+$/, "")
      : "D:\\Deploy\\Claude Code";
    this.tempDir = mkdtempSync(join(tmpdir(), "qq-relay-"));

    /** 对话历史缓存
     *  key  = 私聊: openid  /  群聊: group_id
     *  val  = Array<{ role: "用户"|"你", content: string }> 最多 6 条
     */
    this.historyMap = new Map();
    this.MAX_HISTORY = 6;
  }

  /**
   * 获取会话的唯一 key
   */
  _getConvKey(msg) {
    return msg.type === "group" ? `group:${msg.group_id}` : `private:${msg.openid}`;
  }

  /**
   * 将 QQ 消息发给 Claude Code Agent 处理，获取回复
   */
  getReply(msg) {
    const prefix = msg.type === "group" ? `[群聊 ${msg.group_id}] ` : "[私聊] ";
    console.log(`[Agent] 请求 Claude Code: ${prefix}${msg.content}`);

    try {
      const prompt = this._buildPrompt(msg);
      const reply = this._callClaude(prompt);

      const trimmed = reply ? reply.slice(0, 80) + (reply.length > 80 ? "..." : "") : "(空)";
      console.log(`[Agent] Claude 回复: ${trimmed}`);

      // 保存历史：用户消息 + 机器人回复
      if (reply !== null) {
        this._saveHistory(msg, reply);
      }

      return reply;

    } catch (err) {
      console.error("[Agent] Claude Code 调用失败:", err.message);
      return null;
    }
  }

  /**
   * 构造发给 Claude Code 的 prompt（含历史记录）
   */
  _buildPrompt(msg) {
    const lines = [
      "你是 QQ 机器人助手 Vector，请回复以下通过",
      msg.type === "group" ? `QQ群(群ID:${msg.group_id})` : "QQ私聊",
      "收到的用户消息。保持对话连贯自然。",
      "",
      "回复要求:",
      "- 用中文回复，简洁自然",
      "- 直接回复用户即可，不要复述历史",
      "- 禁止使用任何 emoji 和表情符号",
      "",
      "你可以使用 MCP 工具和系统工具来帮助回答问题。",
      "",
    ];

    // 插入历史记录（最近 6 条）
    const key = this._getConvKey(msg);
    const history = this.historyMap.get(key);
    if (history && history.length > 0) {
      lines.push("--- 以下为最近的历史对话 ---");
      for (const entry of history) {
        lines.push(`${entry.role}: ${entry.content}`);
      }
      lines.push("--- 历史结束 ---");
      lines.push("");
    }

    lines.push("用户消息:");
    lines.push(msg.content);
    lines.push("");
    lines.push("你的回复:");

    return lines.join("\n");
  }

  /**
   * 保存消息到历史缓存（保留最近 MAX_HISTORY 条）
   */
  _saveHistory(msg, reply) {
    const key = this._getConvKey(msg);
    if (!this.historyMap.has(key)) {
      this.historyMap.set(key, []);
    }
    const history = this.historyMap.get(key);

    // 追加用户消息和机器人回复
    history.push({ role: "用户", content: msg.content });
    history.push({ role: "你", content: reply });

    // 裁剪到最多 MAX_HISTORY 条
    if (history.length > this.MAX_HISTORY) {
      const excess = history.length - this.MAX_HISTORY;
      history.splice(0, excess);
    }
  }

  /**
   * 调用 claude -p 子进程获取回复
   */
  _callClaude(prompt) {
    const tmpFile = join(this.tempDir, `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`);
    writeFileSync(tmpFile, prompt, "utf-8");

    try {
      const mcpConfigPath = join(process.cwd(), "claude.json");
      const cmd = `claude -p --bare --tools "default" --mcp-config "${mcpConfigPath}" < "${tmpFile}"`;

      const output = execSync(cmd, {
        timeout: 120000,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });

      return output.trim();

    } finally {
      try { unlinkSync(tmpFile); } catch { /* 忽略清理失败 */ }
    }
  }

  /**
   * 判断消息是否需要回复
   */
  shouldReply(msg) {
    return msg.type === "private" || msg.type === "group";
  }
}
