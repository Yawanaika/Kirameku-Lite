import "server-only";
import fs from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { env } from "@/server/env";

const MAX_LATENCY_SAMPLES = 2048;

/**
 * Small in-process metrics store for the single-process deployment. It is not
 * a replacement for a real APM: it only keeps a rolling latency window,
 * request counters and an event-loop-lag histogram so `/api/internal/metrics`
 * and the performance baseline script can spot regressions.
 */
type EventLoopHistogram = ReturnType<typeof monitorEventLoopDelay>;

const latencies = new Float64Array(MAX_LATENCY_SAMPLES);
let latencyCount = 0;
let latencyCursor = 0;
let requestsTotal = 0;
let errorsTotal = 0;
let sqliteBusyTotal = 0;
const statusCounts = new Map<number, number>();
let eventLoopHistogram: EventLoopHistogram | null = null;

function ensureEventLoopHistogram(): EventLoopHistogram | null {
  if (eventLoopHistogram) return eventLoopHistogram;

  try {
    eventLoopHistogram = monitorEventLoopDelay({ resolution: 10 });
    eventLoopHistogram.enable();
  } catch {
    // Metrics must never break request handling.
    eventLoopHistogram = null;
  }
  return eventLoopHistogram;
}

export function recordRequest(status: number, durationMs: number): void {
  ensureEventLoopHistogram();

  requestsTotal += 1;
  if (status >= 500) errorsTotal += 1;

  statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

  latencies[latencyCursor] = durationMs;
  latencyCursor = (latencyCursor + 1) % MAX_LATENCY_SAMPLES;
  latencyCount = Math.min(latencyCount + 1, MAX_LATENCY_SAMPLES);
}

export function recordSqliteBusy(): void {
  sqliteBusyTotal += 1;
}

export interface MetricsSnapshot {
  ok: true;
  timestamp: string;
  uptime_s: number;
  requests_total: number;
  errors_total: number;
  sqlite_busy_total: number;
  requests_by_status: Record<string, number>;
  latency_ms: {
    count: number;
    p50: number | null;
    p95: number | null;
    p99: number | null;
    max: number | null;
  };
  event_loop_lag_ms: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  memory_mb: {
    rss: number;
    heap_used: number;
    heap_total: number;
    external: number;
  };
  db: {
    path: string;
    size_bytes: number | null;
    wal_size_bytes: number | null;
    shm_size_bytes: number | null;
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return round(sorted[index]);
}

function latencySamples(): number[] {
  const samples: number[] = [];
  const start =
    (latencyCursor - latencyCount + MAX_LATENCY_SAMPLES) % MAX_LATENCY_SAMPLES;

  for (let i = 0; i < latencyCount; i += 1) {
    samples.push(latencies[(start + i) % MAX_LATENCY_SAMPLES]);
  }
  return samples;
}

function fileSize(path: string): number | null {
  try {
    return fs.statSync(path).size;
  } catch {
    return null;
  }
}

function eventLoopPercentile(
  histogram: EventLoopHistogram | null,
  p: number,
): number {
  return histogram ? round(histogram.percentile(p) / 1e6) : 0;
}

export function getMetrics(): MetricsSnapshot {
  const histogram = ensureEventLoopHistogram();
  const samples = latencySamples();
  const memory = process.memoryUsage();

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime_s: Math.round(process.uptime()),
    requests_total: requestsTotal,
    errors_total: errorsTotal,
    sqlite_busy_total: sqliteBusyTotal,
    requests_by_status: Object.fromEntries(
      [...statusCounts.entries()].sort(([a], [b]) => a - b),
    ),
    latency_ms: {
      count: samples.length,
      p50: percentile(samples, 50),
      p95: percentile(samples, 95),
      p99: percentile(samples, 99),
      max: samples.length === 0 ? null : round(Math.max(...samples)),
    },
    event_loop_lag_ms: {
      p50: eventLoopPercentile(histogram, 50),
      p95: eventLoopPercentile(histogram, 95),
      p99: eventLoopPercentile(histogram, 99),
      max: histogram ? round(histogram.max / 1e6) : 0,
    },
    memory_mb: {
      rss: round(memory.rss / 1024 / 1024),
      heap_used: round(memory.heapUsed / 1024 / 1024),
      heap_total: round(memory.heapTotal / 1024 / 1024),
      external: round(memory.external / 1024 / 1024),
    },
    db: {
      path: env.DATABASE_PATH,
      size_bytes: fileSize(env.DATABASE_PATH),
      wal_size_bytes: fileSize(`${env.DATABASE_PATH}-wal`),
      shm_size_bytes: fileSize(`${env.DATABASE_PATH}-shm`),
    },
  };
}

/** Test/maintenance hook; the HTTP endpoint never resets counters. */
export function resetMetrics(): void {
  latencyCount = 0;
  latencyCursor = 0;
  requestsTotal = 0;
  errorsTotal = 0;
  sqliteBusyTotal = 0;
  statusCounts.clear();

  if (eventLoopHistogram) {
    try {
      eventLoopHistogram.disable();
    } catch {
      // Ignore shutdown errors from the histogram.
    }
    eventLoopHistogram = null;
  }
}
