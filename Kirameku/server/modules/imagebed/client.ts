import "server-only";
import { lookup } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { errors } from "@/server/http/errors";
import type { ImagebedRuntimeConfig } from "./contracts";
import { normalizeImagebedBaseUrl } from "./contracts";

const REQUEST_TIMEOUT_MS = 15_000;
const RESPONSE_MAX_BYTES = 64 * 1024;
const IPV4_BLOCKED = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const;

export interface ImagebedTarget {
  baseUrl: string;
  addresses: { address: string; family: 4 | 6 }[];
}

export interface ImagebedUploadRequest {
  endpoint: URL;
  target: ImagebedTarget;
  token: string;
  folder: string;
  input: { key: string; buffer: Buffer; contentType: string };
}

interface ImagebedHttpResponse {
  status: number;
  body: string;
}

function ipv4Number(address: string): number | null {
  if (isIP(address) !== 4) return null;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] << 24) >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inIpv4Range(address: string, network: string, prefix: number): boolean {
  const ip = ipv4Number(address);
  const base = ipv4Number(network);
  if (ip === null || base === null) return true;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) === (base & mask);
}

export function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return !IPV4_BLOCKED.some(([network, prefix]) => inIpv4Range(address, network, prefix));
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:") || !(normalized.startsWith("2") || normalized.startsWith("3"))) return false;
    const secondGroup = Number.parseInt(normalized.split(":")[1] || "0", 16);
    if (normalized.startsWith("2001:") && secondGroup <= 0x01ff) return false;
    if (normalized.startsWith("3fff:") || normalized.startsWith("2001:db8:") || normalized.startsWith("2002:")) return false;
    return true;
  }
  return false;
}

function hostnameOf(baseUrl: string): string {
  return new URL(baseUrl).hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

/** Reject private destinations and pin the validated DNS answer for the HTTP request. */
export async function assertPublicImagebedTarget(baseUrl: string): Promise<ImagebedTarget> {
  let normalized: string;
  try {
    normalized = normalizeImagebedBaseUrl(baseUrl);
  } catch {
    throw errors.validation("图床地址无效");
  }
  const hostname = hostnameOf(normalized);
  if (isIP(hostname)) {
    if (!isPublicIp(hostname)) throw errors.validation("图床地址不能指向内网或保留 IP");
    return { baseUrl: normalized, addresses: [{ address: hostname, family: isIP(hostname) as 4 | 6 }] };
  }
  if (!hostname.includes(".") || hostname === "metadata.google.internal" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw errors.validation("图床地址不能指向本机或内网域名");
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0 || records.some((record) => !isPublicIp(record.address))) {
      throw errors.validation("图床地址解析到内网或保留 IP，已拒绝请求");
    }
    return { baseUrl: normalized, addresses: records.map((record) => ({ address: record.address, family: record.family as 4 | 6 })) };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "VALIDATION_ERROR") throw error;
    throw errors.validation("无法安全解析图床地址");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstPayloadRecord(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) return asRecord(payload[0]);
  const record = asRecord(payload);
  if (!record) return null;
  const nested = record.data;
  if (Array.isArray(nested)) return asRecord(nested[0]);
  return asRecord(nested) ?? record;
}

function resolveImageUrl(source: string, baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(source, baseUrl + "/");
  } catch {
    throw errors.upstream("图床返回了无效图片地址");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    throw errors.upstream("图床返回了不安全图片地址");
  }
  return url;
}

function getRemotePath(record: Record<string, unknown>, sourceUrl: URL): string {
  const explicit = record.remotePath ?? record.path ?? record.id;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim().slice(0, 2048);
  const pathname = sourceUrl.pathname;
  const fileIndex = pathname.indexOf("/file/");
  const path = fileIndex >= 0 ? pathname.slice(fileIndex + 6) : pathname.replace(/^\/+/, "");
  try {
    return decodeURIComponent(path).slice(0, 2048);
  } catch {
    return path.slice(0, 2048);
  }
}

function appendField(chunks: Buffer[], boundary: string, name: string, value: string): void {
  chunks.push(Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n"));
}

function requestMultipart(request: ImagebedUploadRequest): Promise<ImagebedHttpResponse> {
  const boundary = "----kirameku-" + randomBytes(18).toString("hex");
  const filename = request.input.key.slice(request.input.key.lastIndexOf("/") + 1).replace(/["\\\r\n]/g, "_");
  const chunks: Buffer[] = [];
  if (request.folder) appendField(chunks, boundary, "uploadFolder", request.folder);
  chunks.push(Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\nContent-Type: " + request.input.contentType + "\r\n\r\n"));
  chunks.push(request.input.buffer, Buffer.from("\r\n--" + boundary + "--\r\n"));
  const body = Buffer.concat(chunks);
  const hostname = hostnameOf(request.target.baseUrl);
  const pinned = request.target.addresses[0];
  if (!pinned) return Promise.reject(errors.validation("图床域名没有可用的公网地址"));
  const isHttps = request.endpoint.protocol === "https:";
  const requester = isHttps ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const req = requester({
      protocol: request.endpoint.protocol,
      hostname: pinned.address,
      family: pinned.family,
      port: request.endpoint.port || undefined,
      method: "POST",
      path: request.endpoint.pathname + request.endpoint.search,
      ...(isHttps && !isIP(hostname) ? { servername: hostname } : {}),
      headers: {
        Host: request.endpoint.host,
        Authorization: "Bearer " + request.token,
        "Content-Type": "multipart/form-data; boundary=" + boundary,
        "Content-Length": body.length,
      },
    }, (response) => {
      const received: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > RESPONSE_MAX_BYTES) {
          req.destroy(new Error("ImgBed response is too large"));
          return;
        }
        received.push(bytes);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(received).toString("utf8") }));
    });
    const deadline = setTimeout(() => req.destroy(new Error("ImgBed request timed out")), REQUEST_TIMEOUT_MS);
    req.once("close", () => clearTimeout(deadline));
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error("ImgBed request timed out")));
    req.on("error", reject);
    req.end(body);
  });
}

export interface ImagebedUploadResult {
  url: string;
  remotePath: string;
}

export async function uploadToImagebed(
  config: ImagebedRuntimeConfig,
  input: { key: string; buffer: Buffer; contentType: string },
  requestImpl: (request: ImagebedUploadRequest) => Promise<ImagebedHttpResponse> = requestMultipart,
  assertTarget: typeof assertPublicImagebedTarget = assertPublicImagebedTarget,
): Promise<ImagebedUploadResult> {
  const target = await assertTarget(config.baseUrl);
  const endpoint = new URL("upload", target.baseUrl + "/");
  endpoint.searchParams.set("uploadChannel", "telegram");
  endpoint.searchParams.set("returnFormat", "full");
  endpoint.searchParams.set("responseFormat", "object");

  let response: ImagebedHttpResponse;
  try {
    response = await requestImpl({ endpoint, target, token: config.apiToken, folder: config.uploadFolder, input });
  } catch {
    throw errors.upstream("无法连接图床或请求超时");
  }
  if (response.status < 200 || response.status >= 300) {
    if (response.status === 401 || response.status === 403) throw errors.upstream("图床认证失败，请检查 API Token");
    if (response.status === 413) throw errors.payloadTooLarge("图床拒绝了该图片");
    if (response.status === 429) throw errors.rateLimited("图床请求过于频繁，请稍后重试");
    if (response.status >= 500) throw errors.upstream("图床服务暂时不可用");
    throw errors.upstream("图床上传失败");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw errors.upstream("图床返回了无效响应");
  }
  const record = firstPayloadRecord(payload);
  if (!record) throw errors.upstream("图床返回了无效响应");
  const source = typeof record.publicUrl === "string" && record.publicUrl.trim()
    ? record.publicUrl.trim()
    : typeof record.src === "string" ? record.src.trim() : "";
  if (!source) throw errors.upstream("图床响应缺少图片地址");
  const imageUrl = resolveImageUrl(source, target.baseUrl);
  return { url: imageUrl.toString(), remotePath: getRemotePath(record, imageUrl) };
}
