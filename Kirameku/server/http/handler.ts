import crypto from "node:crypto";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { logError, logRequest } from "./logger";

export interface HandlerOptions {
  request?: Request;
  /** Optional actor for audit logs (username or github login). */
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

  try {
    const result = await fn();
    const response =
      result instanceof Response
        ? result
        : result === undefined
          ? new Response(null, { status: 204 })
          : Response.json(result);

    response.headers.set("x-request-id", requestId);
    logRequest({
      requestId,
      method: request?.method,
      path: request ? new URL(request.url).pathname : undefined,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      actor: options.actor,
    });
    return response;
  } catch (error) {
    const result = errorResponse(error, requestId);
    result.response.headers.set("x-request-id", requestId);
    logRequest({
      requestId,
      method: request?.method,
      path: request ? new URL(request.url).pathname : undefined,
      status: result.status,
      durationMs: Math.round(performance.now() - startedAt),
      actor: options.actor,
    });
    return result.response;
  }
}
