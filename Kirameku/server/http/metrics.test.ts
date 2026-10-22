import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getMetrics,
  recordRequest,
  recordSqliteBusy,
  resetMetrics,
} from "./metrics";

describe("http metrics", () => {
  beforeEach(() => resetMetrics());
  afterAll(() => resetMetrics());

  it("computes rolling latency percentiles", () => {
    for (let i = 1; i <= 100; i += 1) {
      recordRequest(200, i);
    }

    const metrics = getMetrics();

    expect(metrics.requests_total).toBe(100);
    expect(metrics.errors_total).toBe(0);
    expect(metrics.latency_ms).toMatchObject({
      count: 100,
      p50: 50,
      p95: 95,
      p99: 99,
      max: 100,
    });
  });

  it("counts server errors and SQLite busy responses separately", () => {
    recordRequest(200, 1);
    recordRequest(503, 2);
    recordRequest(500, 3);
    recordSqliteBusy();
    recordSqliteBusy();

    const metrics = getMetrics();

    expect(metrics.requests_total).toBe(3);
    expect(metrics.errors_total).toBe(2);
    expect(metrics.sqlite_busy_total).toBe(2);
    expect(metrics.requests_by_status).toEqual({
      "200": 1,
      "500": 1,
      "503": 1,
    });
  });

  it("keeps only the most recent latency window", () => {
    for (let i = 1; i <= 2050; i += 1) {
      recordRequest(200, i);
    }

    const metrics = getMetrics();

    expect(metrics.latency_ms.count).toBe(2048);
    expect(metrics.latency_ms.p50).toBe(1026);
    expect(metrics.latency_ms.p95).toBe(1948);
    expect(metrics.latency_ms.p99).toBe(2030);
    expect(metrics.latency_ms.max).toBe(2050);
  });
});
