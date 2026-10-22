import { performance } from "node:perf_hooks";

/**
 * Dependency-free load/smoke baseline for a running production build.
 *
 *   BASE_URL=http://127.0.0.1:3000 CRON_SECRET=... pnpm perf:baseline
 *
 * It measures client-side latency for a mix of pages and APIs, then reads the
 * server-side event-loop/latency snapshot from /api/internal/metrics when
 * CRON_SECRET is available. Run it against a realistic database copy, not the
 * empty fixture database, before treating the numbers as an acceptance result.
 */

const baseUrl = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);
const durationMs = positiveInt("PERF_DURATION_MS", 10_000);
const warmupMs = positiveInt("PERF_WARMUP_MS", 2_000, 0);
const concurrency = positiveInt("PERF_CONCURRENCY", 8);
const requestTimeoutMs = positiveInt("PERF_REQUEST_TIMEOUT_MS", 10_000);
const paths = (
  process.env.PERF_PATHS ??
  "/,/posts,/api/health,/api/posts?page=1&size=10,/feed,/admin/login"
)
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

if (paths.length === 0) {
  throw new Error("PERF_PATHS must contain at least one path");
}
try {
  new URL(baseUrl);
} catch {
  throw new Error(`BASE_URL is not a valid URL: ${baseUrl}`);
}

interface Sample {
  path: string;
  durationMs: number;
  status: number;
  ok: boolean;
  error?: string;
}

interface LatencyStats {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

interface ServerMetrics {
  event_loop_lag_ms?: { p95?: number };
  memory_mb?: { rss?: number };
  sqlite_busy_total?: number;
  db?: { size_bytes?: number | null; wal_size_bytes?: number | null };
}

function positiveInt(name: string, fallback: number, minimum = 1): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  return Math.floor(value);
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return round(sorted[index]);
}

function stats(values: number[]): LatencyStats {
  if (values.length === 0) {
    return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    mean: round(sum / values.length),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: round(Math.max(...values)),
  };
}

async function runPhase(
  phase: "warmup" | "measure",
  phaseDurationMs: number,
): Promise<Sample[]> {
  const samples: Sample[] = [];
  const deadline = performance.now() + phaseDurationMs;
  let sequence = 0;

  async function worker(): Promise<void> {
    while (performance.now() < deadline) {
      const path = paths[sequence % paths.length];
      sequence += 1;
      const startedAt = performance.now();
      let status = 0;
      let error: string | undefined;

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          redirect: "manual",
          headers: { "user-agent": "kirameku-perf-baseline/1.0" },
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        status = response.status;
        await response.arrayBuffer();
        if (!response.ok) error = `HTTP ${status}`;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }

      if (phase === "measure") {
        samples.push({
          path,
          durationMs: performance.now() - startedAt,
          status,
          ok: error === undefined,
          ...(error === undefined ? {} : { error }),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return samples;
}

async function readServerMetrics(): Promise<ServerMetrics | null> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  try {
    const response = await fetch(`${baseUrl}/api/internal/metrics`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.error(
        `[perf] /api/internal/metrics returned HTTP ${response.status}; server metrics omitted`,
      );
      return null;
    }
    return (await response.json()) as ServerMetrics;
  } catch (cause) {
    console.error(
      `[perf] could not read /api/internal/metrics: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    return null;
  }
}

function summarize(samples: Sample[], measuredMs: number) {
  const byPath = new Map<string, Sample[]>();
  for (const sample of samples) {
    const group = byPath.get(sample.path) ?? [];
    group.push(sample);
    byPath.set(sample.path, group);
  }

  const errors = samples.filter((sample) => !sample.ok).length;
  const apiSamples = samples.filter((sample) =>
    sample.path.startsWith("/api/"),
  );

  return {
    duration_ms: Math.round(measuredMs),
    concurrency,
    paths,
    total_requests: samples.length,
    requests_per_second: round(samples.length / (measuredMs / 1000), 1),
    errors,
    error_rate: samples.length === 0 ? 0 : round(errors / samples.length, 4),
    latency_ms: stats(samples.map((sample) => sample.durationMs)),
    api_latency_ms: stats(apiSamples.map((sample) => sample.durationMs)),
    by_path: Object.fromEntries(
      [...byPath.entries()].map(([path, group]) => [
        path,
        {
          requests: group.length,
          errors: group.filter((sample) => !sample.ok).length,
          latency_ms: stats(group.map((sample) => sample.durationMs)),
        },
      ]),
    ),
  };
}

async function main(): Promise<void> {
  console.log(
    `[perf] ${baseUrl} warmup=${warmupMs}ms measure=${durationMs}ms concurrency=${concurrency}`,
  );

  await runPhase("warmup", warmupMs);

  const startedAt = performance.now();
  const samples = await runPhase("measure", durationMs);
  const measuredMs = performance.now() - startedAt;
  const result = summarize(samples, measuredMs);
  const server = await readServerMetrics();

  const checks = {
    no_request_errors: result.errors === 0,
    api_p95_under_300ms:
      result.api_latency_ms.count === 0
        ? null
        : result.api_latency_ms.p95 <= 300,
    event_loop_lag_p95_under_50ms:
      server?.event_loop_lag_ms?.p95 === undefined
        ? null
        : server.event_loop_lag_ms.p95 <= 50,
  };

  console.log(
    JSON.stringify(
      {
        base_url: baseUrl,
        generated_at: new Date().toISOString(),
        ...result,
        server,
        checks,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
