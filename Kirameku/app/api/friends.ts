import { request } from "./client";

export interface FriendLinkItem {
  id: number;
  name: string;
  url: string;
  avatar: string;
  description: string;
  sort: number;
  is_approved: boolean;
  created_at: string;
}

export function getFriendLinks() {
  // Transitional path: /api/friend-links still needs the legacy POST/PUT/DELETE
  // admin handlers until friend-link writes move to the local admin API.
  return request<FriendLinkItem[]>("/api/friend-links/list");
}
