interface RequestLog {
  requestId: string;
  method?: string;
  path?: string;
  status: number;
  durationMs: number;
  actor?: string;
}

export function logRequest(entry: RequestLog): void {
  const line = JSON.stringify({
    level: entry.status >= 500 ? "error" : "info",
    type: "request",
    ...entry,
  });
  if (entry.status >= 500) console.error(line);
  else console.log(line);
}

export function logError(message: string, error: unknown, context?: Record<string, unknown>): void {
  console.error(
    JSON.stringify({
      level: "error",
      type: "exception",
      message,
      context,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    }),
  );
}
