import type { ChannelConfig } from "./contracts";

export interface DeliveryErrorOptions {
  /** Network/timeout/5xx/429 — worth retrying. */
  retryable?: boolean;
  status?: number;
}

export class DeliveryError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options: DeliveryErrorOptions = {}) {
    super(message);
    this.name = "DeliveryError";
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}

export const DEFAULT_TIMEOUT_MS = 10_000;

export async function requestWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DeliveryError(`请求 ${url} 失败：${reason}`, { retryable: true });
  }
}

export async function safeText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  } catch {
    return "";
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function stringValue(
  config: ChannelConfig,
  key: string,
  fallback = "",
): string {
  const value = config[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean") return String(value);
  return fallback;
}

export function booleanValue(config: ChannelConfig, key: string): boolean {
  const value = config[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true";
  }
  return false;
}

export function numberValue(
  config: ChannelConfig,
  key: string,
): number | null {
  const raw = stringValue(config, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
