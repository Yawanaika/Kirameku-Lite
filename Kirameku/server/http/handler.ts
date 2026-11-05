import crypto from "node:crypto";
import { ZodError } from "zod";
import { recordAdminRequestAudit } from "./audit";
import {
  runWithAuditContext,
  type RequestAuditContext,
} from "./audit-context";
import { AppError } from "./errors";
import { logError, logRequest } from "./logger";
import { recordRequest, recordSqliteBusy } from "./metrics";

export interface HandlerOptions {
  request?: Request;
  /** Optional actor override for request logs (username or github login). */
  actor?: string;
}

function readRetryAfterMs(details: unknown): number | null {
  if (typeof details !== "object" || details === null) return null;
  const value = (details as { retryAfterMs?: unknown }).retryAfterMs;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function errorResponse(
  error: unknown,
  requestId: string,
): { response: Response; status: number } {
  if (error instanceof ZodError) {
    return {
      status: 422,
      response: Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "参数校验失败",
            details: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
          requestId,
        },
        { status: 422 },
      ),
    };
  }

  if (error instanceof AppError) {
    const response = Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
        requestId,
      },
      { status: error.status },
    );
    // 429 带上 Retry-After，客户端和反代才知道什么时候可以重试，
    // 否则只能盲目重试、反而把限流窗口继续顶满。
    if (error.status === 429) {
      const retryAfterMs = readRetryAfterMs(error.details);
      if (retryAfterMs !== null) {
        response.headers.set(
          "Retry-After",
          String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
        );
      }
    }
    return { status: error.status, response };
  }

  const sqliteCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (sqliteCode === "SQLITE_BUSY" || sqliteCode === "SQLITE_LOCKED") {
    recordSqliteBusy();
    return {
      status: 503,
      response: Response.json(
        {
          error: {
            code: "DB_BUSY",
            message: "数据库繁忙，请稍后重试",
          },
          requestId,
        },
        { status: 503 },
      ),
    };
  }
  if (sqliteCode === "SQLITE_READONLY") {
    return {
      status: 503,
      response: Response.json(
        {
          error: { code: "READ_ONLY", message: "数据库处于只读模式" },
          requestId,
        },
        { status: 503 },
      ),
    };
  }

  logError("Unhandled API error", error, { requestId });
  return {
    status: 500,
    response: Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "服务器内部错误",
        },
        requestId,
      },
      { status: 500 },
    ),
  };
}

/**
 * Wrap a Route Handler so every response uses the same error envelope and every
 * request gets a requestId. Handlers may return a `Response` (for cookies,
 * streams, etc.) or a JSON-serializable value.
 */
export async function handle(
  fn: () => Promise<Response | unknown> | Response | unknown,
  options: HandlerOptions = {},
): Promise<Response> {
  const request = options.request;
  const requestId =
    request?.headers.get("x-request-id") || crypto.randomUUID();
  const startedAt = performance.now();
  const auditContext: RequestAuditContext = {};

  try {
    const result = await runWithAuditContext(auditContext, fn);
    const response =
      result instanceof Response
        ? result
        : result === undefined
          ? new Response(null, { status: 204 })
          : Response.json(result);

    response.headers.set("x-request-id", requestId);
    await recordAdminRequestAudit({
      request,
      response,
      actor: auditContext.actor,
      result,
    });
    const durationMs = performance.now() - startedAt;
    recordRequest(response.status, durationMs);
    logRequest({
      requestId,
      method: request?.method,
      path: request ? new URL(request.url).pathname : undefined,
      status: response.status,
      durationMs: Math.round(durationMs),
      actor: auditContext.actor?.username ?? options.actor,
    });
    return response;
  } catch (error) {
    const result = errorResponse(error, requestId);
    result.response.headers.set("x-request-id", requestId);
    const durationMs = performance.now() - startedAt;
    recordRequest(result.status, durationMs);
    logRequest({
      requestId,
      method: request?.method,
      path: request ? new URL(request.url).pathname : undefined,
      status: result.status,
      durationMs: Math.round(durationMs),
      actor: auditContext.actor?.username ?? options.actor,
    });
    return result.response;
  }
}
