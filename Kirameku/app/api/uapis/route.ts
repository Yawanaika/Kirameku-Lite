import { NextRequest } from "next/server";
import { errors } from "@/server/http/errors";
import { handle } from "@/server/http/handler";
import { getClientIp } from "@/server/http/ip";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { TtlCache } from "@/server/http/ttl-cache";

const BASE = "https://uapis.cn/api/v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Only the endpoints the toolbox actually calls. Keeping an explicit allowlist
 * prevents this route from becoming an open proxy for arbitrary uapis.cn paths.
 */
const ALLOWED_GET_PATHS = new Set([
  "misc/movie-box-office",
  "misc/hotboard",
  "misc/worldtime",
  "misc/phoneinfo",
  "misc/tracking/query",
  "history/programmer/today",
  "github/repo",
  "github/user",
]);

const ALLOWED_POST_PATHS = new Set(["search/aggregate"]);

const cache = new TtlCache<{ status: number; body: unknown }>(CACHE_TTL_MS);

function readPath(request: NextRequest): string {
  const subPath = request.nextUrl.searchParams.get("path")?.trim() ?? "";
  if (!subPath) throw errors.badRequest("Missing 'path' parameter.");
  if (!/^[a-z0-9/_-]+$/i.test(subPath) || subPath.includes("..")) {
    throw errors.badRequest("路径格式非法");
  }
  return subPath;
}

function buildTargetUrl(request: NextRequest, subPath: string): string {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.delete("path");
  const qs = params.toString();
  return `${BASE}/${subPath}${qs ? `?${qs}` : ""}`;
}

function jsonResponse(
  body: unknown,
  status: number,
  cacheable: boolean,
): Response {
  return Response.json(body, {
    status,
    headers: cacheable
      ? { "cache-control": "public, max-age=300, stale-while-revalidate=600" }
      : { "cache-control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  return handle(
    async () => {
      const ip = getClientIp(request);
      enforceRateLimit(`uapis:${ip}`, 60, 60_000);

      const subPath = readPath(request);
      if (!ALLOWED_GET_PATHS.has(subPath)) {
        throw errors.forbidden("不支持的 UAPI 路径");
      }

      const target = buildTargetUrl(request, subPath);
      const cached = cache.get(target);
      if (cached) return jsonResponse(cached.body, cached.status, true);

      let response: Response;
      try {
        response = await fetch(target, {
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        });
      } catch {
        throw errors.upstream("请求外部 API 失败");
      }

      const body = (await response.json().catch(() => null)) as unknown;
      if (response.ok && body !== null) {
        cache.set(target, { status: response.status, body });
      }
      return jsonResponse(
        body ?? { message: "外部 API 返回了非 JSON 响应" },
        response.status,
        response.ok,
      );
    },
    { request },
  );
}

export async function POST(request: NextRequest) {
  return handle(
    async () => {
      const ip = getClientIp(request);
      enforceRateLimit(`uapis:${ip}`, 60, 60_000);

      const subPath = readPath(request);
      if (!ALLOWED_POST_PATHS.has(subPath)) {
        throw errors.forbidden("不支持的 UAPI 路径");
      }

      const payload = await request.json().catch(() => null);
      if (payload === null) throw errors.badRequest("请求体必须是 JSON");

      let response: Response;
      try {
        response = await fetch(buildTargetUrl(request, subPath), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        });
      } catch {
        throw errors.upstream("请求外部 API 失败");
      }

      const body = (await response.json().catch(() => null)) as unknown;
      return jsonResponse(
        body ?? { message: "外部 API 返回了非 JSON 响应" },
        response.status,
        false,
      );
    },
    { request },
  );
}
