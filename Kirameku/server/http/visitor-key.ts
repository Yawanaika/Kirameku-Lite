import { createHash } from "node:crypto";
import { getClientIp } from "./ip";

/**
 * 访客去重键：IP + User-Agent + Accept-Language 的散列。
 *
 * 这不是身份认证，只是让同一个浏览器对同一个目标的重复点赞算一次。
 * 之所以不直接用 IP：同一个出口 IP 下所有设备会撞在一起；掺上 UA 和
 * 语言偏好能区分开大部分真实用户。原始值不落库，避免存储额外个人数据。
 */
export function getVisitorKey(request: Request): string {
  const parts = [
    getClientIp(request),
    request.headers.get("user-agent") ?? "",
    request.headers.get("accept-language") ?? "",
  ];
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
}
