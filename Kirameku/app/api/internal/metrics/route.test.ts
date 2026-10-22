import { beforeEach, describe, expect, it } from "vitest";
import { resetMetrics } from "@/server/http/metrics";
import { GET } from "./route";

const METRICS_URL = "http://localhost:3000/api/internal/metrics";
const CRON_SECRET = "test-cron-secret-0123456789abcdef";

describe("GET /api/internal/metrics", () => {
  beforeEach(() => resetMetrics());

  it("rejects requests without a token", async () => {
    const response = await GET(new Request(METRICS_URL));
    expect(response.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const response = await GET(
      new Request(METRICS_URL, {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns metrics with the bearer token", async () => {
    const response = await GET(
      new Request(METRICS_URL, {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.requests_total).toBe(0);
    expect(body.latency_ms.count).toBe(0);
    expect(body.event_loop_lag_ms.p95).toBeGreaterThanOrEqual(0);
    expect(body.db.path).toBeTruthy();
  });

  it("accepts the x-cron-secret header", async () => {
    const response = await GET(
      new Request(METRICS_URL, {
        headers: { "x-cron-secret": CRON_SECRET },
      }),
    );
    expect(response.status).toBe(200);
  });
});
