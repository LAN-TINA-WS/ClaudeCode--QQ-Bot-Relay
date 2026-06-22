# QQ Bot Relay

[![GitHub stars](https://img.shields.io/github/stars/LAN-TINA-WS/ClaudeCode--QQ-Bot-Relay)](https://github.com/LAN-TINA-WS/ClaudeCode--QQ-Bot-Relay/stargazers)
[![GitHub license](https://img.shields.io/github/license/LAN-TINA-WS/ClaudeCode--QQ-Bot-Relay)](https://github.com/LAN-TINA-WS/ClaudeCode--QQ-Bot-Relay)

**QQ Bot Relay** is a message relay that connects Tencent QQ to **Claude Code** as an AI agent. It receives QQ messages via WebSocket, forwards them to Claude Code for AI processing, and sends the reply back — all fully automated.

QQ 消息中转程序，接入 **Claude Code** 作为 AI Agent 自动回复。

---

## Architecture / 架构

```
QQ User / QQ 用户
  |
QQ Open Platform WebSocket / 开放平台长连接
  |
qq-relay (this program / 本程序)
  |
  v
claude -p (Claude Code CLI Agent)
  |
  v
Reply back to QQ / 回复消息到 QQ
```

Every message is processed by a full Claude Code agent with tool calling, MCP servers, and context awareness — not just a simple API call.

每条消息都通过完整的 Claude Code Agent 处理，拥有工具调用、MCP 服务器、上下文记忆等能力。

---

## Requirements / 环境要求

| Dependency | Version | Purpose | Install |
|---|---|---|---|
| **Node.js** | >= 18 | Runtime | [nodejs.org](https://nodejs.org) |
| **Claude Code CLI** | latest | AI Agent | `npm i -g @anthropic-ai/claude-code` |
| **uv** | latest | MCP tool runner | [docs.astral.sh/uv](https://docs.astral.sh/uv/) |

`claude` and `uv` must be installed manually. npm dependencies (`ws`, `dotenv`) are handled by the setup wizard.

`claude` 和 `uv` 需手动安装，npm 依赖由安装向导自动处理。

> Windows: **Git Bash** or **PowerShell** recommended.

---

## Quick Start / 快速开始

### One-Click Setup / 一键配置

```bash
setup.bat
```

The wizard will guide you through / 安装向导会依次：

1. Check Node.js / 检查 Node.js 环境
2. Install npm dependencies (`npm i`) / 自动安装 npm 依赖
3. Configure Claude Code directory / 配置 Claude Code 目录路径
4. Enter QQ AppID and AppSecret / 输入 QQ 开放平台凭证
5. Test connection (optional) / 测试连接（可选）
6. Capture your QQ openID / 获取用户的 openID

### Start / 启动

```bash
npm start
```

Or double-click `start.bat`. The bot connects to QQ and starts processing messages automatically.

### Stop / 停止

```bash
stop.bat
```

Stops the QQ Bot and cleans up orphaned Claude Code processes. Running `stop.bat` after closing `start.bat` ensures no lingering processes.

一键停止 QQ Bot 并清理残留的 Claude Code 子进程。

### Utility Commands / 配置助手

```bash
node setup.js check         # Verify config / 验证配置
node setup.js capture-id    # Capture your openID / 捕获 openID
node setup.js show-id       # Show saved user info / 显示已保存信息
```

---

## Configuration / 配置说明

### Claude Code Directory / Claude Code 目录

Set `CLAUDE_CODE_DIR` in `.env`, or configure it interactively via `setup.bat`. Leave empty to use the default path.

通过 `.env` 中的 `CLAUDE_CODE_DIR` 指定，留空则使用默认路径。

### MCP Tools

MCP servers are defined in `claude.json`. The spawned Claude Code agent loads them automatically:

- **kill-process** — Process management / 进程管理
- **mcp-pyautogui** — Mouse & keyboard automation / 鼠标键盘自动化
- **mcp-vision** — Image analysis & OCR / 图片分析与 OCR

Edit `claude.json` to add or remove servers. MCP packages are auto-downloaded by `uvx` on first use.

如需调整，直接编辑 `claude.json` 即可。MCP 包由 `uvx` 在首次调用时自动下载。

---

## File Structure / 文件结构

```
src/
  index.js        Entry point — message routing, dedup, queue
  qq-client.js    QQ WebSocket client
  agent-client.js Claude Code agent launcher
  config.js       Config loader
claude.json       MCP server definitions
stop.bat          One-click stop script
```

---

## Dependencies / 依赖

### npm (auto-installed / 自动安装)

- **ws** — QQ WebSocket client
- **dotenv** — Environment variable loader

### System Tools (manual install / 手动安装)

**claude** (Claude Code CLI) — AI agent core:

```bash
npm install -g @anthropic-ai/claude-code
```

**uv** — MCP runtime. `uvx` auto-downloads and runs MCP server packages:

```bash
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## License

MIT
