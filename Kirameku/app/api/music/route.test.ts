import { beforeEach, describe, expect, it, vi } from "vitest";

const { metingPlaylist, metingSong, metingUrl, metingPic, enforceRateLimit } = vi.hoisted(() => ({
  metingPlaylist: vi.fn(),
  metingSong: vi.fn(),
  metingUrl: vi.fn(),
  metingPic: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("@meting/core", () => {
  class MetingMock {
    format() {}
    playlist(id: string) {
      return metingPlaylist(id);
    }
    song(id: string) {
      return metingSong(id);
    }
    url(id: string, br: number) {
      return metingUrl(id, br);
    }
    pic(id: string, size: number) {
      return metingPic(id, size);
    }
  }
  return { default: MetingMock };
});
vi.mock("@/server/http/handler", () => ({
  handle: async (action: () => Promise<Response>) => action(),
}));
vi.mock("@/server/http/rate-limit", () => ({ enforceRateLimit }));
vi.mock("@/server/http/ip", () => ({ getClientIp: () => "203.0.113.10" }));

import { GET } from "./route";

function track(id: string) {
  return {
    id,
    name: "song " + id,
    artist: ["someone"],
    pic_id: "pic-" + id,
    url_id: "url-" + id,
    lyric_id: "lyric-" + id,
  };
}

function musicRequest(query: string) {
  return {
    nextUrl: new URL("http://localhost:3000/api/music" + query),
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  metingUrl.mockResolvedValue(JSON.stringify({ url: "http://m8.music.126.net/a.mp3" }));
  metingPic.mockResolvedValue(JSON.stringify({ url: "http://p3.music.126.net/a.jpg" }));
});

describe("GET /api/music", () => {
  it("returns a diagnostic message instead of a silent empty array", async () => {
    metingPlaylist.mockResolvedValue(JSON.stringify([track("1"), track("2")]));
    metingUrl.mockResolvedValue(JSON.stringify({ url: null }));

    const response = await GET(musicRequest("?id=628549602"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.songs).toEqual([]);
    expect(body.total).toBe(2);
    expect(body.skipped).toBe(2);
    expect(body.message).toContain("不可播放");
    // 空结果不缓存，否则配置或版权恢复后还要等 10 分钟。
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not cache an empty result, so the next request retries upstream", async () => {
    metingPlaylist.mockResolvedValue(JSON.stringify([track("3")]));
    metingUrl.mockResolvedValue(JSON.stringify({ url: null }));

    const empty = await GET(musicRequest("?id=777"));
    expect((await empty.json()).songs).toEqual([]);

    metingUrl.mockResolvedValue(JSON.stringify({ url: "https://m8.music.126.net/b.mp3" }));
    const retry = await GET(musicRequest("?id=777"));
    const body = await retry.json();

    expect(body.songs).toHaveLength(1);
    expect(body.songs[0].src).toBe("https://m8.music.126.net/b.mp3");
    expect(metingPlaylist).toHaveBeenCalledTimes(2);
  });

  it("caches playable results and reports skipped tracks", async () => {
    metingPlaylist.mockResolvedValue(JSON.stringify([track("10"), track("11")]));
    metingUrl.mockImplementation(async (id: string) =>
      JSON.stringify({ url: id === "url-10" ? "http://m8.music.126.net/c.mp3" : null }),
    );

    const response = await GET(musicRequest("?id=4242"));
    const body = await response.json();

    expect(body.songs).toHaveLength(1);
    expect(body.songs[0].cover).toBe("https://p3.music.126.net/a.jpg");
    expect(body.skipped).toBe(1);
    expect(body.message).toContain("跳过 1 首");
    expect(response.headers.get("cache-control")).toContain("max-age=600");

    const cached = await GET(musicRequest("?id=4242"));
    expect((await cached.json()).songs).toHaveLength(1);
    expect(metingPlaylist).toHaveBeenCalledTimes(1);
  });

  it("explains an empty playlist instead of pretending nothing is configured", async () => {
    metingPlaylist.mockResolvedValue(JSON.stringify([]));

    const response = await GET(musicRequest("?id=999"));
    const body = await response.json();

    expect(body.songs).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.message).toContain("歌单 ID");
  });

  it("keeps working when a single requested song cannot be found", async () => {
    metingSong.mockImplementation(async (id: string) => {
      if (id === "2") throw new Error("not found");
      return JSON.stringify([track(id)]);
    });

    const response = await GET(musicRequest("?ids=1,2"));
    const body = await response.json();

    expect(body.source).toBe("ids");
    expect(body.songs).toHaveLength(1);
    expect(body.songs[0].id).toBe("1");
  });
});
