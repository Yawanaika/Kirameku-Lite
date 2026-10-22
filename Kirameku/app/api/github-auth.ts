import { request } from "./client";
import type { GitHubUser } from "./types";

/**
 * GitHub 登录态保存在 httpOnly Cookie 中，前端只读取公开资料。
 * 不在此处传递 token，避免任何脚本可读的凭据。
 */
export function getGithubUser() {
  return request<GitHubUser>("/api/auth/github/me", { cache: "no-store" });
}

export function logoutGithubUser() {
  return request<{ ok: boolean }>("/api/auth/github/logout", {
    method: "POST",
  });
}
