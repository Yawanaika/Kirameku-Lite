import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, saveDraft, assertWritable, assertSameOrigin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(), saveDraft: vi.fn(), assertWritable: vi.fn(), assertSameOrigin: vi.fn(),
}));
vi.mock("@/server/auth/guard", () => ({ requireAdmin }));
vi.mock("@/server/http/handler", () => ({
  handle: async (action: () => Promise<unknown>) => Response.json(await action()),
}));
vi.mock("@/server/http/write-guard", () => ({ assertWritable }));
vi.mock("@/server/http/origin", () => ({ assertSameOrigin }));
vi.mock("@/server/modules/posts", () => ({ getPostsService: () => ({ saveDraft }) }));

import { POST } from "./route";

const snapshot = {
  title: "Draft", slug: "draft", description: "", content: "content", cover: "",
  category_id: null, tags: [], status: "draft", scheduled_at: null, is_pinned: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  saveDraft.mockResolvedValue({ post_id: 12 });
});

describe("POST /api/admin/posts/draft", () => {
  it("validates and stores a new autosaved working copy behind admin write guards", async () => {
    const request = new Request("http://localhost/api/admin/posts/draft", {
      method: "POST", headers: { "content-type": "application/json", "origin": "http://localhost" },
      body: JSON.stringify(snapshot),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ post_id: 12 });
    expect(assertWritable).toHaveBeenCalledOnce();
    expect(assertSameOrigin).toHaveBeenCalledWith(request);
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(saveDraft).toHaveBeenCalledWith(null, snapshot);
  });
});
