import "dotenv/config";

export const config = {
  qq: {
    appId: process.env.QQ_APP_ID || "",
    appSecret: process.env.QQ_APP_SECRET || "",
  },
  relay: {
    systemPrompt: process.env.SYSTEM_PROMPT || "你是一个友好的 QQ 机器人助手 Vector。",
  },
};
