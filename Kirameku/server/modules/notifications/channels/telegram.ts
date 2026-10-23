import type { ChannelConfig, NotificationMessage } from "../contracts";
import { formatTelegramText } from "../format";
import {
  DeliveryError,
  booleanValue,
  numberValue,
  requestWithTimeout,
  safeText,
  stringValue,
} from "../transport";

const API_BASE = "https://api.telegram.org";

/** Send one alert through the Telegram Bot API. */
export async function sendTelegram(
  config: ChannelConfig,
  message: NotificationMessage,
): Promise<void> {
  const token = stringValue(config, "botToken");
  const chatId = stringValue(config, "chatId");
  if (!token || !chatId) {
    throw new DeliveryError("Telegram 未配置 Bot Token 或 Chat ID");
  }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: formatTelegramText(message),
    disable_notification: booleanValue(config, "silent"),
    disable_web_page_preview: true,
  };

  const threadId = numberValue(config, "messageThreadId");
  if (threadId !== null) payload.message_thread_id = threadId;

  const response = await requestWithTimeout(
    `${API_BASE}/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const detail = await safeText(response);
    throw new DeliveryError(
      `Telegram 发送失败（${response.status}）${detail ? `：${detail}` : ""}`,
      {
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      },
    );
  }
}
