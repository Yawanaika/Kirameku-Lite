export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "UPSTREAM_ERROR"
  | "DB_BUSY"
  | "READ_ONLY";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const errors = {
  badRequest: (message = "请求参数错误", details?: unknown) =>
    new AppError("BAD_REQUEST", message, 400, details),
  unauthorized: (message = "请先登录") =>
    new AppError("UNAUTHORIZED", message, 401),
  forbidden: (message = "没有权限") => new AppError("FORBIDDEN", message, 403),
  notFound: (message = "资源不存在") => new AppError("NOT_FOUND", message, 404),
  conflict: (message = "资源冲突") => new AppError("CONFLICT", message, 409),
  validation: (message = "参数校验失败", details?: unknown) =>
    new AppError("VALIDATION_ERROR", message, 422, details),
  rateLimited: (message = "请求过于频繁，请稍后再试", details?: unknown) =>
    new AppError("RATE_LIMITED", message, 429, details),
  payloadTooLarge: (message = "文件超过大小限制") =>
    new AppError("PAYLOAD_TOO_LARGE", message, 413),
  unsupportedMediaType: (message = "不支持的文件类型") =>
    new AppError("UNSUPPORTED_MEDIA_TYPE", message, 415),
  upstream: (message = "上游服务请求失败", details?: unknown) =>
    new AppError("UPSTREAM_ERROR", message, 502, details),
  readOnly: () =>
    new AppError("READ_ONLY", "当前处于只读维护期，暂时不能写入", 503),
  internal: (message = "服务器内部错误") =>
    new AppError("INTERNAL_ERROR", message, 500),
};
