export interface AdminApiErrorDetail {
  path: string;
  message: string;
}

interface ErrorPayload {
  error?: {
    message?: string;
    details?: AdminApiErrorDetail[];
  };
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly details: AdminApiErrorDetail[];

  constructor(
    message: string,
    status: number,
    details: AdminApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.details = details;
  }
}

export async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.assign("/admin/login");
    }

    const errorPayload = payload as ErrorPayload | null;
    throw new AdminApiError(
      errorPayload?.error?.message ?? `请求失败（${response.status}）`,
      response.status,
      errorPayload?.error?.details ?? [],
    );
  }

  return payload as T;
}

export function adminQuery(
  values: Record<string, string | number | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function describeAdminError(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.details.length > 0) {
      return `${error.message}：${error.details
        .map((detail) => `${detail.path || "字段"} ${detail.message}`)
        .join("；")}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
