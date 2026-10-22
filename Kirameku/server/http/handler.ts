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
    return {
      status: error.status,
      response: Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
            ...(error.details === undefined ? {} : { details: error.details }),
          },
          requestId,
        },
        { status: error.status },
      ),
    };
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
