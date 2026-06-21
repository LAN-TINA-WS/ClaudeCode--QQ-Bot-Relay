import WebSocket from "ws";
import { config } from "./config.js";

const QQ_AUTH_API = "https://bots.qq.com/app/getAppAccessToken";
const QQ_API_BASE = "https://api.sgroup.qq.com";
const QQ_WS_URL = "wss://api.sgroup.qq.com/websocket/";

export class QQClient {
  constructor() {
    this.token = null;
    this.tokenExpiresAt = 0;
    this.ws = null;
    this.wsSeq = 0;
    this.wsSessionId = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.messageHandler = null; // 回调: (msg) => void
    this.connected = false;
  }

  // ========== Token 管理 ==========

  async getAccessToken() {
    const now = Date.now();
    if (this.token && this.tokenExpiresAt > now + 60000) return this.token;

    const res = await fetch(QQ_AUTH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: config.qq.appId,
        client_secret: config.qq.appSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`Token 获取失败: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    this.token = data.access_token;
    this.tokenExpiresAt = now + parseInt(data.expires_in) * 1000;
    console.log(`[QQ] Token 已获取，有效期 ${data.expires_in}s`);
    return this.token;
  }

  // ========== HTTP API 调用 ==========

  async callAPI(path, options = {}) {
    const token = await this.getAccessToken();
    const url = `${QQ_API_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `QQBot ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`QQ API 错误 ${res.status}: ${body}`);
    }

    return res.json();
  }

  /** 发送私聊消息 */
  async sendPrivateMessage(openid, content, msgType = 0) {
    return this.callAPI(`/v2/users/${openid}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, msg_type: msgType }),
    });
  }

  /** 发送群消息 */
  async sendGroupMessage(groupOpenid, content, msgType = 0) {
    return this.callAPI(`/v2/groups/${groupOpenid}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, msg_type: msgType }),
    });
  }

  /** 获取机器人信息 */
  async getBotInfo() {
    return this.callAPI("/v2/users/me");
  }

  // ========== WebSocket 连接 ==========

  onMessage(handler) {
    this.messageHandler = handler;
  }

  async connect() {
    try {
      const token = await this.getAccessToken();
      console.log("[QQ WS] 正在连接...");

      this.ws = new WebSocket(QQ_WS_URL, {
        headers: { Authorization: `QQBot ${token}` },
      });

      this.ws.on("open", () => {
        this.connected = true;
        console.log("[QQ WS] 已连接");
      });

      this.ws.on("message", (raw) => this._handleWSMessage(raw, token));

      this.ws.on("close", (code) => {
        this.connected = false;
        console.log(`[QQ WS] 断开 (code=${code})，5 秒后重连`);
        this._cleanup();
        this._scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        console.error("[QQ WS] 错误:", err.message);
      });

    } catch (err) {
      console.error("[QQ WS] 连接失败:", err.message);
      this._scheduleReconnect(10000);
    }
  }

  _handleWSMessage(raw, token) {
    try {
      const msg = JSON.parse(raw.toString());
      const { op, d, s, t } = msg;
      if (s) this.wsSeq = s;

      switch (op) {

        case 10: { // Hello
          console.log("[QQ WS] Hello 收到，发送 Identify...");
          this._sendWS({
            op: 2,
            d: {
              token: `QQBot ${token}`,
              intents: 1 << 25, // GROUP_AND_C2C_EVENT
              shard: [0, 1],
              properties: { $os: "windows", $browser: "qq_relay", $device: "qq_relay" },
            },
          });
          // 启动心跳
          const interval = d.heartbeat_interval || 45000;
          this.heartbeatTimer = setInterval(() => {
            this._sendWS({ op: 1, d: this.wsSeq || null });
          }, interval);
          break;
        }

        case 0: { // Dispatch
          if (t === "READY") {
            this.wsSessionId = d.session_id;
            console.log(`[QQ WS] 鉴权成功! Bot=${d.user.username}, session=${d.session_id}`);
          } else if (t === "RESUMED") {
            console.log("[QQ WS] 会话恢复成功");
          } else if (t === "C2C_MESSAGE_CREATE") {
            this._emitMessage({
              type: "private",
              id: d.id,
              openid: d.author?.user_openid || d.author?.id || "未知",
              content: d.content || "",
              timestamp: new Date().toISOString(),
            });
          } else if (t === "GROUP_AT_MESSAGE_CREATE") {
            this._emitMessage({
              type: "group",
              id: d.id,
              openid: d.author?.member_openid || "未知",
              group_id: d.group_openid || "",
              content: d.content || "",
              timestamp: new Date().toISOString(),
            });
          }
          break;
        }

        case 7: // Reconnect
          console.log("[QQ WS] 收到重连指令");
          this.ws.close();
          break;

        case 9: // Invalid Session
          console.error("[QQ WS] Session 无效，重连中");
          this.ws.close();
          break;

        case 11: // Heartbeat ACK
          // 静默忽略
          break;
      }
    } catch (e) {
      console.error("[QQ WS] 消息解析错误:", e.message);
    }
  }

  _emitMessage(info) {
    const display = info.type === "group"
      ? `[群消息] 群${info.group_id} 用户${info.openid}: ${info.content}`
      : `[私聊] ${info.openid}: ${info.content}`;
    console.log(`[QQ] ${display}`);

    if (this.messageHandler) {
      this.messageHandler(info);
    }
  }

  _sendWS(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  _cleanup() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _scheduleReconnect(delay = 5000) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect() {
    this._cleanup();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}
