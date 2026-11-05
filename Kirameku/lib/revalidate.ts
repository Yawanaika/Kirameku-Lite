import { revalidatePath } from "next/cache";

/**
 * 前台大多数页面是 ISR（见各 page.tsx 的 `export const revalidate`），
 * 后台写完数据后必须显式失效，否则最长要等 5 分钟才能看到改动。
 *
 * `revalidatePath` 在非 Next 请求上下文（单元测试、独立脚本）里会抛错，
 * 这里统一吞掉：调用方只关心写操作本身是否成功。
 */
function safeRevalidate(path: string, type?: "page" | "layout"): void {
  try {
    revalidatePath(path, type);
  } catch {
    // 非请求上下文，忽略。
  }
}

/** 文章：首页、列表、详情、归档。 */
export function revalidatePosts(): void {
  safeRevalidate("/");
  safeRevalidate("/posts");
  safeRevalidate("/posts/[slug]", "page");
  safeRevalidate("/timeline");
}

/** 说说：首页最新说说、说说页、归档。 */
export function revalidateChatters(): void {
  safeRevalidate("/");
  safeRevalidate("/moments");
  safeRevalidate("/timeline");
}

/** 相册与照片：首页照片墙预览、照片墙。 */
export function revalidateAlbums(): void {
  safeRevalidate("/");
  safeRevalidate("/photowall");
}

/** 项目：首页、项目页。 */
export function revalidateProjects(): void {
  safeRevalidate("/");
  safeRevalidate("/projects");
}

/** 友链：首页、友链页。 */
export function revalidateFriendLinks(): void {
  safeRevalidate("/");
  safeRevalidate("/friends");
}

/** 收藏夹：首页、收藏夹页。 */
export function revalidateBookmarks(): void {
  safeRevalidate("/");
  safeRevalidate("/bookmark");
}

/** 分类/标签：文章列表筛选与详情页的分类标签展示。 */
export function revalidateTaxonomy(): void {
  safeRevalidate("/");
  safeRevalidate("/posts");
  safeRevalidate("/posts/[slug]", "page");
}

/** 导航与站点配置：影响全站布局。 */
export function revalidateSiteChrome(): void {
  safeRevalidate("/", "layout");
}
