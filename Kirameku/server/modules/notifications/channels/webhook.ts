import crypto from "node:crypto";
import type { ChannelConfig, NotificationMessage } from "../contracts";
import { formatWebhookPayload } from "../format";
import {
  DeliveryError,
  requestWithTimeout,
  safeText,
  stringValue,
} from "../transport";

function parseHeaders(config: ChannelConfig): Record<string, string> {
  const raw = stringValue(config, "headers");
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" || typeof value === "number") {
        headers[key] = String(value);
      }
    }
    return headers;
  } catch {
    throw new DeliveryError("Webhook 附加请求头必须是 JSON 对象");
  }
}

/** POST the alert payload as JSON, optionally HMAC-SHA256 signed. */
export async function sendWebhook(
  config: ChannelConfig,
  message: NotificationMessage,
): Promise<void> {
  const url = stringValue(config, "url");
  if (!url) throw new DeliveryError("Webhook 未配置回调地址");

  const body = JSON.stringify(formatWebhookPayload(message));
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "Kirameku-Alerts/1.0",
    "x-kirameku-event": message.eventKey,
    ...parseHeaders(config),
  };

  const secret = stringValue(config, "secret");
  if (secret) {
    headers["x-kirameku-signature"] =
      `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  }

  const response = await requestWithTimeout(url, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const detail = await safeText(response);
    throw new DeliveryError(
      `Webhook 返回 ${response.status}${detail ? `：${detail}` : ""}`,
      {
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      },
    );
  }
}
