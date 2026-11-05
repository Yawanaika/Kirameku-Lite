import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errors } from "./errors";
import { handle } from "./handler";

function request(path = "/api/test") {
  return new Request("http://localhost" + path, { method: "POST" });
}

describe("handle", () => {
  it("returns JSON and always stamps a request id", async () => {
    const response = await handle(() => ({ hello: "world" }), {
      request: request(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({ hello: "world" });
  });

  it("keeps an explicit response and its status", async () => {
    const response = await handle(
      () => new Response("teapot", { status: 418 }),
      { request: request() },
    );

    expect(response.status).toBe(418);
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("maps undefined to 204", async () => {
    const response = await handle(() => undefined, { request: request() });
    expect(response.status).toBe(204);
  });

  it("turns a ZodError into a 422 with field details", async () => {
    const schema = z.object({ title: z.string().min(3) });
    const response = await handle(
      () => schema.parse({ title: "a" }),
      { request: request() },
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details[0].path).toBe("title");
    expect(body.requestId).toBe(response.headers.get("x-request-id"));
  });

  it("adds Retry-After to a rate limited response", async () => {
    const response = await handle(
      () => {
        throw errors.rateLimited("太频繁了", { retryAfterMs: 4_500 });
      },
      { request: request() },
    );

    expect(response.status).toBe(429);
    // 向上取整，4.5s → 5s
    expect(response.headers.get("Retry-After")).toBe("5");
    const body = await response.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("omits Retry-After when the error has no retry hint", async () => {
    const response = await handle(
      () => {
        throw errors.rateLimited();
      },
      { request: request() },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeNull();
  });

  it("hides unknown error details behind a 500 envelope", async () => {
    const response = await handle(
      () => {
        throw new Error("kaboom with secret path /var/data.db");
      },
      { request: request() },
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("kaboom");
  });

  it("reports SQLITE_BUSY as a retryable 503", async () => {
    const response = await handle(
      () => {
        throw Object.assign(new Error("busy"), { code: "SQLITE_BUSY" });
      },
      { request: request() },
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("DB_BUSY");
  });
});
