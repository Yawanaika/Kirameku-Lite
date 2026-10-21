import { createHmac } from "node:crypto";
import { env } from "@/server/env";
import { errors } from "@/server/http/errors";

export interface OssConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint: string;
  customDomain?: string;
  prefix: string;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//i, "");
}

export function normalizeOssPrefix(prefix: string | undefined): string {
  if (!prefix) return "";
  return prefix.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * OSS configuration is all-or-nothing. A half-configured bucket must not
 * silently fall back to local disk in production, so it fails loudly instead.
 */
export function getOssConfig(): OssConfig | null {
  const values = [
    env.OSS_ACCESS_KEY_ID,
    env.OSS_ACCESS_KEY_SECRET,
    env.OSS_BUCKET_NAME,
    env.OSS_ENDPOINT,
  ];
  const configured = values.filter(Boolean).length;
  if (configured === 0) return null;
  if (configured !== values.length) {
    throw errors.internal("OSS 配置不完整，请检查 OSS_* 环境变量");
  }

  return {
    accessKeyId: env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET!,
    bucket: env.OSS_BUCKET_NAME!,
    endpoint: stripTrailingSlash(stripProtocol(env.OSS_ENDPOINT!)),
    customDomain: env.OSS_CUSTOM_DOMAIN,
    prefix: normalizeOssPrefix(env.OSS_PREFIX),
  };
}

function encodeObjectKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildOssPublicUrl(
  config: OssConfig,
  key: string,
  customDomain = config.customDomain,
): string {
  const encodedKey = encodeObjectKey(key);
  if (customDomain) {
    return `${stripTrailingSlash(customDomain)}/${encodedKey}`;
  }
  return `https://${config.bucket}.${config.endpoint}/${encodedKey}`;
}

/**
 * Alibaba Cloud OSS V1 signature string. Keeping this pure makes the signing
 * logic unit-testable without network access.
 */
export function buildOssCanonicalString(input: {
  bucket: string;
  key: string;
  contentType: string;
  date: string;
  contentMd5?: string;
}): string {
  return [
    "PUT",
    input.contentMd5 ?? "",
    input.contentType,
    input.date,
    `/${input.bucket}/${input.key}`,
  ].join("\n");
}

export function signOssRequest(input: {
  accessKeySecret: string;
  bucket: string;
  key: string;
  contentType: string;
  date: string;
  contentMd5?: string;
}): string {
  const canonical = buildOssCanonicalString(input);
  return createHmac("sha1", input.accessKeySecret)
    .update(canonical, "utf8")
    .digest("base64");
}

export async function putOssObject(
  config: OssConfig,
  key: string,
  body: Buffer,
  contentType: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const date = new Date().toUTCString();
  const signature = signOssRequest({
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    key,
    contentType,
    date,
  });
  const encodedKey = encodeObjectKey(key);
  const url = `https://${config.bucket}.${config.endpoint}/${encodedKey}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "PUT",
      headers: {
        Authorization: `OSS ${config.accessKeyId}:${signature}`,
        "Content-Type": contentType,
        Date: date,
      },
      body: new Uint8Array(body),
    });
  } catch (error) {
    throw errors.upstream("无法连接 OSS", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  if (!response.ok) {
    throw errors.upstream("OSS 上传失败", { status: response.status });
  }
}
