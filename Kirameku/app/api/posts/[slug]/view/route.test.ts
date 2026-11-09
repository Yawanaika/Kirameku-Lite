import { beforeEach, describe, expect, it, vi } from "vitest";

const { assertWritable, assertSameOrigin, getVisitorKey, incrementView } =
  vi.hoisted(() => ({
    assertWritable: vi.fn(),
    assertSameOrigin: vi.fn(),
    getVisitorKey: vi.fn(),
    incrementView: vi.fn(),
  }));

vi.mock("@/server/http/handler", () => ({
  handle: async (action: () => Promise<unknown>) => {
    try {
      return Response.json(await action());
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number(error.status)
          : 500;
      return Response.json(
        { error: error instanceof Error ? error.message : "error" },
        { status },
      );
    }
  },
}));
vi.mock("@/server/http/visitor-key", () => ({ getVisitorKey }));
vi.mock("@/server/http/origin", () => ({ assertSameOrigin }));
vi.mock("@/server/http/write-guard", () => ({ assertWritable }));
vi.mock("@/server/modules/posts", () => ({
  getPostsService: () => ({ incrementView }),
}));

import { POST } from "./route";

function request(postId: string) {
  return new Request(`http://localhost/api/posts/${postId}/view`, {
    method: "POST",
    headers: { origin: "http://localhost" },
  });
}

function invoke(postId: string) {
  return POST(request(postId), { params: Promise.resolve({ slug: postId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  getVisitorKey.mockReturnValue("visitor-hash");
  incrementView.mockResolvedValue({ counted: true, views: 8 });
});

describe("POST /api/posts/[id]/view", () => {
  it("rejects invalid article ids before touching the service", async () => {
    const response = await invoke("0");
    expect(response.status).toBe(400);
    expect(incrementView).not.toHaveBeenCalled();
  });

  it("propagates unpublished or missing article failures", async () => {
    incrementView.mockRejectedValueOnce(Object.assign(new Error("文章不存在"), { status: 404 }));
    const response = await invoke("9");
    expect(response.status).toBe(404);
  });

  it("records the first view using a visitor key and UTC day", async () => {
    const response = await invoke("7");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ counted: true, views: 8 });
    expect(assertWritable).toHaveBeenCalledOnce();
    expect(assertSameOrigin).toHaveBeenCalledWith(expect.any(Request));
    expect(incrementView).toHaveBeenCalledWith(
      7,
      "visitor-hash",
      new Date().toISOString().slice(0, 10),
    );
  });

  it("returns the service's same-day deduplication result", async () => {
    incrementView.mockResolvedValueOnce({ counted: false });
    const response = await invoke("7");
    expect(await response.json()).toEqual({ counted: false });
  });

  it("does not write when the write guard rejects", async () => {
    assertWritable.mockImplementationOnce(() => {
      throw Object.assign(new Error("readonly"), { status: 503 });
    });
    const response = await invoke("7");
    expect(response.status).toBe(503);
    expect(assertSameOrigin).not.toHaveBeenCalled();
    expect(incrementView).not.toHaveBeenCalled();
  });

  it("does not write when the origin check rejects", async () => {
    assertSameOrigin.mockImplementationOnce(() => {
      throw Object.assign(new Error("cross-origin"), { status: 403 });
    });
    const response = await invoke("7");
    expect(response.status).toBe(403);
    expect(incrementView).not.toHaveBeenCalled();
  });

  it("allows retry after a failed database write", async () => {
    incrementView
      .mockRejectedValueOnce(new Error("temporary write failure"))
      .mockResolvedValueOnce({ counted: true, views: 8 });
    expect((await invoke("7")).status).toBe(500);
    const retry = await invoke("7");
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ counted: true, views: 8 });
    expect(incrementView).toHaveBeenCalledTimes(2);
  });
});
