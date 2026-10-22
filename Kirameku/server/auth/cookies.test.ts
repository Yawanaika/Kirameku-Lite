import { describe, expect, it } from "vitest";
import { readCookie } from "./cookies";

describe("readCookie", () => {
  it("returns null when the header is missing", () => {
    expect(readCookie(new Request("http://localhost/"), "kir_gh")).toBeNull();
  });

  it("finds a cookie among unrelated values", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: "theme=dark; kir_gh=abc.def.ghi; other=1" },
    });
    expect(readCookie(request, "kir_gh")).toBe("abc.def.ghi");
  });

  it("decodes percent-encoded values", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: `kir_gh=${encodeURIComponent("a b;c")}` },
    });
    expect(readCookie(request, "kir_gh")).toBe("a b;c");
  });

  it("returns null for malformed encoding", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: "kir_gh=%E0%A4%A" },
    });
    expect(readCookie(request, "kir_gh")).toBeNull();
  });

  it("does not match a cookie whose name is a suffix", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: "x_kir_gh=nope" },
    });
    expect(readCookie(request, "kir_gh")).toBeNull();
  });
});
