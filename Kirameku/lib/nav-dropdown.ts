/**
 * 导航栏自定义下拉菜单的共享配置模型。
 *
 * 配置保存在 site_config 表的 `nav_dropdown` 键里（JSON 字符串），
 * 前台 Navbar 与后台编辑页共用这里的解析器，保证两边对同一份数据的理解一致。
 * 本文件不依赖任何服务端模块，可以被客户端组件直接引用。
 */

export const NAV_DROPDOWN_CONFIG_KEY = "nav_dropdown";

/** 一个下拉菜单最多挂多少条链接。 */
export const NAV_DROPDOWN_MAX_LINKS = 20;

export const navDropdownIconNames = [
  "link",
  "compass",
  "globe",
  "sparkles",
  "star",
  "book",
  "folder",
  "users",
  "camera",
  "music",
  "heart",
  "gamepad",
] as const;

export type NavDropdownIconName = (typeof navDropdownIconNames)[number];

/** 后台下拉选择器里展示的中文图标名。 */
export const navDropdownIconLabels: Record<NavDropdownIconName, string> = {
  link: "链接",
  compass: "指南针",
  globe: "地球",
  sparkles: "星芒",
  star: "星星",
  book: "书本",
  folder: "文件夹",
  users: "人群",
  camera: "相机",
  music: "音符",
  heart: "爱心",
  gamepad: "手柄",
};

export interface NavDropdownLink {
  label: string;
  href: string;
  /** 可选的一行补充说明，展示在菜单条目的名称下方。 */
  description: string;
}

export interface NavDropdownConfig {
  enabled: boolean;
  label: string;
  icon: NavDropdownIconName;
  links: NavDropdownLink[];
}

export function createDefaultNavDropdownConfig(): NavDropdownConfig {
  return { enabled: false, label: "更多", icon: "link", links: [] };
}

const HREF_PREFIXES = ["/", "#", "http://", "https://", "mailto:", "tel:"];

/**
 * 只允许站内路径、锚点与常见安全协议，挡掉 `javascript:`、`data:` 这类
 * 可以在导航栏里执行脚本的地址。
 */
export function isSafeHref(value: string): boolean {
  const href = value.trim();
  if (!href) return false;
  // 协议相对地址（//example.com）走 https，按外部链接处理。
  if (href.startsWith("//")) return true;
  const lower = href.toLowerCase();
  return HREF_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/** 是否需要在新的标签页打开（http/https 与协议相对地址）。 */
export function isExternalHref(value: string): boolean {
  const href = value.trim();
  if (href.startsWith("//")) return true;
  const lower = href.toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
}

/** 是否能交给 next/link 处理（站内路径与锚点）。 */
export function isInternalHref(value: string): boolean {
  const href = value.trim();
  return href.startsWith("/") || href.startsWith("#");
}

/** 当前路由是否命中这条站内链接。 */
export function isNavLinkActive(pathname: string, href: string): boolean {
  if (!isInternalHref(href) || href.startsWith("#")) return false;
  if (href === "/") return pathname === "/";
  const base = href.replace(/\/+$/, "");
  if (!base) return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseLink(raw: unknown): NavDropdownLink | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const label = readText(record.label ?? record.name).slice(0, 60);
  const href = readText(record.href ?? record.url).slice(0, 500);
  if (!label || !isSafeHref(href)) return null;
  const description = readText(record.description).slice(0, 160);
  return { label, href, description };
}

/**
 * 把任意存储值（JSON 字符串、已解析对象、甚至一个裸链接数组）整理成合法配置。
 * 任何无法识别的字段都会退回默认值，绝不抛错：导航栏不能因为配置坏了而整站崩掉。
 */
export function parseNavDropdownConfig(raw: unknown): NavDropdownConfig {
  const fallback = createDefaultNavDropdownConfig();

  let value: unknown = raw;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return fallback;
    try {
      value = JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  if (Array.isArray(value)) {
    const links = value
      .map(parseLink)
      .filter((link): link is NavDropdownLink => link !== null)
      .slice(0, NAV_DROPDOWN_MAX_LINKS);
    return { ...fallback, enabled: links.length > 0, links };
  }

  if (typeof value !== "object" || value === null) return fallback;
  const record = value as Record<string, unknown>;

  const rawLinks = Array.isArray(record.links)
    ? record.links
    : Array.isArray(record.items)
      ? record.items
      : [];
  const links = rawLinks
    .map(parseLink)
    .filter((link): link is NavDropdownLink => link !== null)
    .slice(0, NAV_DROPDOWN_MAX_LINKS);

  const rawIcon = record.icon;
  const icon = navDropdownIconNames.includes(rawIcon as NavDropdownIconName)
    ? (rawIcon as NavDropdownIconName)
    : fallback.icon;

  const label = readText(record.label).slice(0, 40) || fallback.label;
  const enabled =
    typeof record.enabled === "boolean" ? record.enabled : links.length > 0;

  return { enabled, label, icon, links };
}
