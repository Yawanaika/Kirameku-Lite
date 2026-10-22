import { request, qs } from "./client";
import type { GitHubUser } from "./types";

export interface MessageItem {
  id: number;
  github_user_id: number | null;
  parent_id: number | null;
  content: string;
  status: string;
  likes: number;
  created_at: string;
  github_user: GitHubUser | null;
  replies: MessageItem[];
}

export function getMessages(params?: { page?: number; size?: number }) {
  return request<MessageItem[]>(`/api/messages${qs(params)}`);
}

export function getMessagesCount() {
  return request<{ count: number }>("/api/messages/count");
}

export function createMessage(data: {
  content: string;
  parent_id?: number;
}) {
  return request<MessageItem>("/api/messages", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function likeMessage(msgId: number, unlike = false) {
  return request<MessageItem>(`/api/messages/${msgId}/${unlike ? "unlike" : "like"}`, {
    method: "POST",
  });
}
