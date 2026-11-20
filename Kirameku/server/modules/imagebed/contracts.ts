import { z } from "zod";

export const IMAGEBED_CHANNEL = "telegram" as const;
export const IMAGEBED_BASE_URL_MAX = 2048;
export const IMAGEBED_FOLDER_MAX = 120;

export interface ImagebedSettingsView {
  enabled: boolean;
  baseUrl: string;
  uploadChannel: typeof IMAGEBED_CHANNEL;
  uploadFolder: string;
  tokenConfigured: boolean;
}

export interface ImagebedRuntimeConfig {
  baseUrl: string;
  apiToken: string;
  uploadFolder: string;
}

/** Syntactic validation only; network targets are checked by the server module. */
export function normalizeImagebedBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > IMAGEBED_BASE_URL_MAX) {
    throw new Error("图床地址过长");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("图床地址需要是完整的 HTTP(S) URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("图床地址仅支持 HTTP(S)");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("图床地址不能包含用户名、密码、查询串或片段");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal")) {
    throw new Error("图床地址不能指向本机或内网域名");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("生产环境的图床地址必须使用 HTTPS");
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (path.toLowerCase().endsWith("/upload")) {
    throw new Error("图床地址填写服务根地址，不要包含 /upload");
  }
  url.pathname = path;
  return url.toString().replace(/\/$/, "");
}

const baseUrl = z.string().trim().max(IMAGEBED_BASE_URL_MAX).default("").superRefine((value, context) => {
  try {
    normalizeImagebedBaseUrl(value);
  } catch (error) {
    context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "图床地址无效" });
  }
});

const uploadFolder = z.string().trim().max(IMAGEBED_FOLDER_MAX, "上传目录最多 120 个字符").regex(/^(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/, "上传目录仅支持字母、数字、下划线、连字符和 / 分段").default("");

export const imagebedSettingsInput = z.object({
  enabled: z.boolean().default(false),
  baseUrl,
  apiToken: z.string().trim().max(4096, "Token 过长").default(""),
  clearApiToken: z.boolean().default(false),
  uploadFolder,
});

export type ImagebedSettingsInput = z.infer<typeof imagebedSettingsInput>;
