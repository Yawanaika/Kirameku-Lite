import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { assertSameOrigin } from "./origin";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers,
  });
}

describe("same-origin guard", () => {
  it("allows an absent Origin header for non-browser clients", () => {
    expect(() => assertSameOrigin(requestWith({ host: "localhost:3000" }))).not.toThrow();
  });

  it("allows a matching Origin", () => {
    expect(() =>
      assertSameOrigin(
        requestWith({
          host: "localhost:3000",
          origin: "http://localhost:3000",
        }),
      ),
    ).not.toThrow();
  });

  it("rejects a cross-site Origin", () => {
    expect(() =>
      assertSameOrigin(
        requestWith({
          host: "localhost:3000",
          origin: "https://evil.example",
        }),
      ),
    ).toThrow(AppError);
  });
});
