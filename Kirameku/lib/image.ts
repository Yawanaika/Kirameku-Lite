/**
 * 图片地址工具。
 *
 * 站内图片（`/uploads/...`、`/images/...`）由 next/image 优化器处理：尺寸裁剪、
 * avif/webp 转码都走这一层。
 *
 * 但后台配置与用户输入带来的图片地址是不可预测的（头像、背景图、文章封面、
 * 说说配图、照片墙……），域名无法预先登记。这类地址不应该交给 /_next/image 代理：
 * 一旦放宽 remotePatterns 到任意主机，就等于把本站开放成任意第三方的免费图片
 * 转码代理，白白消耗带宽与 CPU，还可能被用来探测内网。
 *
 * 所以外链一律在组件层加 unoptimized，让浏览器直连图片源，只损失一点转码收益。
 * 例外是下面这份可信名单：域名固定、流量大、值得转码，继续走优化器。
 */

/**
 * 外链中仍然走 next/image 优化器的可信域名。
 *
 * 这里的每个域名都必须在 next.config.mjs 的 images.remotePatterns 里登记过，
 * 否则优化器会直接返回 400。
 */
const OPTIMIZED_EXTERNAL_HOSTS = [
  // GitHub 头像：评论、留言、说说里大量出现，尺寸小但请求量高
  "avatars.githubusercontent.com",
];

/** 取出 URL 的 hostname，取不到就返回空串。 */
function hostnameOf(src: string): string {
  try {
    // 协议相对地址补一个协议才能被 URL 解析
    const normalized = src.startsWith("//") ? `https:${src}` : src;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** 是否是需要绕过 next/image 优化器的外部地址。 */
export function bypassImageOptimization(src: string | null | undefined): boolean {
  if (!src) return false;
  const value = src.trim();
  const lower = value.toLowerCase();
  // 协议相对地址（//cdn.example.com/a.png）同样是外链
  const isRemote =
    lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("//");
  if (!isRemote) return false;
  // 可信名单里的域名继续交给优化器
  return !OPTIMIZED_EXTERNAL_HOSTS.includes(hostnameOf(value));
}
