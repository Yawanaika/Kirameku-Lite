import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createMessage,
  notify,
  requireGithubUser,
  logError,
} = vi.hoisted(() => ({
  createMessage: vi.fn(),
  notify: vi.fn(),
  requireGithubUser: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/server/http/handler", () => ({
  handle: async (action: () => Promise<unknown>) =>
    Response.json(await action()),
}));
vi.mock("@/server/http/rate-limit", () => ({
  enforceIpRateLimit: vi.fn(),
}));
vi.mock("@/server/http/ip", () => ({
  getClientIp: () => "203.0.113.10",
}));
vi.mock("@/server/http/origin", () => ({
  assertSameOrigin: vi.fn(),
}));
vi.mock("@/server/http/write-guard", () => ({
  assertWritable: vi.fn(),
}));
vi.mock("@/server/modules/messages", () => ({
  getMessagesService: () => ({ create: createMessage }),
}));
vi.mock("@/server/modules/notifications", () => ({
  getNotificationsService: () => ({ notify }),
}));
vi.mock("@/server/modules/github-auth", () => ({
  requireGithubUser,
}));
vi.mock("@/server/http/logger", () => ({ logError }));

import { POST } from "./route";

const createdMessage = {
  id: 42,
  content: "Hello from the guestbook",
  parent_id: null,
};

function messageRequest() {
  return new Request("http://localhost:3000/api/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: createdMessage.content }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createMessage.mockResolvedValue(createdMessage);
  notify.mockResolvedValue({ eventKey: "message.created", sent: true, outcomes: [] });
  requireGithubUser.mockResolvedValue({ id: 7, login: "octocat" });
});

describe("POST /api/messages notifications", () => {
  it("dispatches an immediate event after the message is saved", async () => {
    let saved = false;
    createMessage.mockImplementation(async () => {
      saved = true;
      return createdMessage;
    });
    notify.mockImplementation(async () => {
      expect(saved).toBe(true);
      return { eventKey: "message.created", sent: true, outcomes: [] };
    });

    const response = await POST(messageRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(createdMessage);
    expect(notify).toHaveBeenCalledWith(
      {
        eventKey: "message.created",
        level: "info",
        title: "收到新留言",
        body: createdMessage.content,
        force: false,
        fields: [
          { label: "留言者", value: "octocat" },
          { label: "留言 ID", value: "42" },
        ],
      },
      { recordSkip: true },
    );
    expect(logError).not.toHaveBeenCalled();
  });

  it("returns the saved message if notification dispatch throws", async () => {
    const error = new Error("Telegram unavailable");
    notify.mockRejectedValue(error);

    const response = await POST(messageRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(createdMessage);
    expect(logError).toHaveBeenCalledWith(
      "发送新留言通知失败",
      error,
      { messageId: createdMessage.id },
    );
  });
});
