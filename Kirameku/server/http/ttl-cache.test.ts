import { describe, expect, it } from "vitest";
import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  it("returns values until they expire", () => {
    const cache = new TtlCache<number>(50);
    cache.set("a", 1);

    expect(cache.get("a")).toBe(1);
  });

  it("expires entries after the ttl", async () => {
    const cache = new TtlCache<number>(5);
    cache.set("a", 1);

    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts the oldest entry when full", () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("clear drops all entries", () => {
    const cache = new TtlCache<number>(60_000);
    cache.set("a", 1);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
  });
});
