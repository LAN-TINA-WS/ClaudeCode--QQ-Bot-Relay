import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * AgentClient - 通过 claude -p 子进程接入 Claude Code 作为 AI Agent
 *
 * 将 QQ 消息写入临时文件，调用 claude -p 处理并获取回复。
 * 使用临时文件避免 Windows 命令行转义问题。
 */
export class AgentClient {
  constructor() {
    // Windows 下需要 .cmd 后缀才能被 cmd.exe 正确识别
    this.claudePath = process.platform === "win32"
      ? join(process.env.APPDATA || "", "npm", "claude.cmd")
      : "claude";
    this.tempDir = mkdtempSync(join(tmpdir(), "qq-relay-"));
  }

  /**
   * 将 QQ 消息发给 Claude Code Agent 处理，获取回复
   */
  async getReply(msg) {
    const prefix = msg.type === "group" ? `[群聊 ${msg.group_id}] ` : "[私聊] ";
    console.log(`[Agent] 请求 Claude Code: ${prefix}${msg.content}`);

    try {
      const prompt = this._buildPrompt(msg);
      const reply = this._callClaude(prompt);

      const trimmed = reply ? reply.slice(0, 80) + (reply.length > 80 ? "..." : "") : "(空)";
      console.log(`[Agent] Claude 回复: ${trimmed}`);
      return reply;

    } catch (err) {
      console.error("[Agent] Claude Code 调用失败:", err.message);
      return null;
    }
  }

  /**
   * 构造发给 Claude Code 的 prompt
   */
  _buildPrompt(msg) {
    return [
      "你是 QQ 机器人助手 Vector，请回复以下通过",
      msg.type === "group" ? `QQ群(群ID:${msg.group_id})` : "QQ私聊",
      "收到的用户消息。",
      "",
      "回复要求:",
      "- 用中文回复，简洁自然",
      "- 直接回复用户即可",
      "",
      "用户消息:",
      msg.content,
      "",
      "你的回复:",
    ].join("\n");
  }

  /**
   * 调用 claude -p 子进程获取回复
   *
   * 使用临时文件传递 prompt，避免 Windows 命令行长度和转义问题。
   */
  _callClaude(prompt) {
    // 写 prompt 到临时文件
    const tmpFile = join(this.tempDir, `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`);
    writeFileSync(tmpFile, prompt, "utf-8");

    try {
      // Windows: cmd.exe 调用 claude.cmd；类 Unix: 直接调 claude
      const shell = process.platform === "win32" ? undefined : undefined; // 使用默认 shell

      const cmd = process.platform === "win32"
        ? `"${this.claudePath}" -p --bare --allowedTools "" < "${tmpFile}"`
        : `claude -p --bare --allowedTools "" < "${tmpFile}"`;

      const output = execSync(cmd, {
        timeout: 120000,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });

      return output.trim();

    } finally {
      // 清理临时文件
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
