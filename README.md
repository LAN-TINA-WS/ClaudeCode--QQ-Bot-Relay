# QQ Bot Relay

QQ 消息中转程序，接入 **Claude Code** 作为 AI Agent 自动回复。

## 架构

```
QQ 用户
  |
QQ 开放平台 WebSocket (实时推送)
  |
qq-relay (本程序 ─ 维持长连接 + 消息队列)
  |
  v
claude -p (调用 Claude Code CLI 作为 Agent 处理消息)
  |
  v
回复消息 -> QQ 用户
```

区别于直接调 API：每条消息都通过 `claude -p` 交给 Claude Code（完整 AI Agent）
处理，拥有完整的工具调用、MCP 工具、上下文等能力。

## 环境要求

| 依赖 | 版本要求 | 用途 | 安装方式 |
|---|---|---|---|
| **Node.js** | >= 18 | 运行本程序 | [nodejs.org](https://nodejs.org) |
| **Claude Code CLI** | 最新版 | AI Agent 核心 | `npm i -g @anthropic-ai/claude-code` |
| **uv** | 最新版 | 运行 MCP 工具（进程管理/自动化/OCR） | 详见 [docs.astral.sh/uv](https://docs.astral.sh/uv/) |
其中 `claude` 和 `uv` 需要手动安装，npm 依赖（`ws`、`dotenv`）由安装向导自动处理。

> Windows 用户建议使用 **Git Bash** 或 **PowerShell** 运行本程序。

## 快速开始

### 首次使用：一键配置

```bash
setup.bat
```

安装向导会依次：
1. 检查 Node.js 环境
2. 自动安装 npm 依赖（`npm i`）
3. 配置 Claude Code 目录路径
4. 提示输入 QQ 开放平台的 AppID 和 AppSecret
5. 测试连接
6. 获取你的 QQ 用户 openID（向 Bot 发一条消息即可自动捕获）

### 启动

```bash
npm start
```

或双击 `start.bat`，程序启动后将自动连接 QQ，收到消息后调用 `claude -p` 获取回复并发送回用户。

### 停止

```bash
stop.bat
```

一键停止 QQ Bot 并清理残留的 Claude Code 子进程。直接关闭 `start.bat` 窗口可能导致
Claude Code 进程残留，运行 `stop.bat` 可彻底清理。

### 配置助手（单独使用）

```bash
node setup.js check         # 验证配置是否完整
node setup.js capture-id    # 捕获你的 QQ openID
node setup.js show-id       # 显示已保存的用户信息
```

## 配置说明

### Claude Code 目录

通过 `.env` 文件中的 `CLAUDE_CODE_DIR` 指定 Claude Code 的工作目录，也可在 `setup.bat`
安装向导中交互配置。留空则使用系统默认路径。

### MCP 工具

程序通过 `claude.json` 配置 MCP 服务器，spawn 的 Claude Code 子进程自动加载以下工具：

- **kill-process**: 进程管理
- **mcp-pyautogui**: 鼠标键盘自动化
- **mcp-vision**: 图片分析与 OCR

如需调整，直接编辑 `claude.json` 即可。

## 文件结构

```
src/
  index.js        主入口：消息路由 + 去重 + 串行队列
  qq-client.js    QQ Bot WebSocket 客户端（实时接收 + 发送）
  agent-client.js Claude Code Agent 调用层（claude -p 子进程）
  config.js       配置加载
claude.json       MCP 服务器配置
stop.bat          一键停止脚本
```

## 依赖

### npm（由 setup.bat 自动安装）

- **ws** — QQ 开放平台 WebSocket 客户端
- **dotenv** — 从 `.env` 加载环境变量

### 系统工具（需手动安装）

- **claude**（Claude Code CLI）— AI Agent 核心，处理用户消息并调用工具。建议全局安装：
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```

- **uv** — MCP 工具运行时，`uvx` 自动下载并执行 MCP 服务器包：
  ```bash
  # Windows (PowerShell)
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

  # macOS / Linux
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

