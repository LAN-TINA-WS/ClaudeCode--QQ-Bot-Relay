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
处理，拥有完整的工具调用、CLAUDE.md 指令、上下文等能力。

## 快速开始

### 首次使用：一键配置

```bash
setup.bat
```

安装向导会依次：
1. 检查 Node.js 环境
2. 自动安装 npm 依赖（`npm i`）
3. 提示输入 QQ 开放平台的 AppID 和 AppSecret
4. 获取你的 QQ 用户 openID（向 Bot 发一条消息即可自动捕获）

### 启动

```bash
npm start
```

或双击 `start.bat`，程序启动后将自动连接 QQ，收到消息后调用 `claude -p` 获取回复并发送回用户。

### 配置助手（单独使用）

```bash
node setup.js check         # 验证配置是否完整
node setup.js capture-id    # 捕获你的 QQ openID
node setup.js show-id       # 显示已保存的用户信息
```

## 文件结构

```
src/
  index.js       主入口：消息路由 + 去重 + 串行队列
  qq-client.js   QQ Bot WebSocket 客户端（实时接收 + 发送）
  agent-client.js Claude Code Agent 调用层（claude -p 子进程）
  config.js      配置加载
```

## 依赖

仅需 `ws`（WebSocket）和 `dotenv`（环境变量），AI 处理完全依赖系统已安装的
`claude` 命令（Claude Code CLI）。
