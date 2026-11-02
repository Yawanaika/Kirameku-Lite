import { siteConfig } from "@/siteConfig";

/**
 * 全站可配置项的类型、出厂默认值与容错解析。
 *
 * 这个模块同时被服务端（metadata / RSS / 接口）和客户端组件引用，所以不能引入
 * 任何服务端依赖。`siteConfig.ts` 保留为「出厂默认值」——后台没配置过的字段一律
 * 回落到它，这样升级时不会丢默认值，也保证 env 覆盖链（SITE_SHARE_*、SITE_URL）
 * 仍然有兜底。
 */

/** 存在 site_config 表里的键名。 */
export const SITE_SETTINGS_CONFIG_KEY = "site_settings";

/** 各字段的长度 / 数量上限，前后端共用，避免两边校验写歪。 */
export const SITE_SETTINGS_LIMITS = {
  siteTitle: 80,
  authorName: 40,
  bio: 240,
  url: 500,
  image: 500,
  buildDate: 40,
  chatterTitle: 40,
  chatterDescription: 160,
  socialValue: 200,
  badgeName: 40,
  badgeColor: 40,
  icpName: 80,
  musicId: 40,
  bgImages: 24,
  themeColors: 8,
  footerBadges: 8,
  musicTrackIds: 200,
} as const;

export type SiteShareCard = "summary" | "summary_large_image";

export interface SiteSettingsProfile {
  /** 站点标题，用于浏览器标签、分享卡片与后台标题。 */
  siteTitle: string;
  authorName: string;
  bio: string;
  avatarUrl: string;
  /** ISO 时间串，站点仪表盘用它算运行天数。 */
  buildDate: string;
  social: {
    github: string;
    email: string;
    wechat: string;
    tg: string;
  };
}

export interface SiteSettingsAppearance {
  useGradient: boolean;
  themeColors: string[];
  bgImages: string[];
  defaultPostCover: string;
}

export interface SiteSettingsShare {
  image: string;
  card: SiteShareCard;
}

export interface SiteSettingsFooterBadge {
  name: string;
  color: string;
}

export interface SiteSettingsContent {
  chatterTitle: string;
  chatterDescription: string;
  footerBadges: SiteSettingsFooterBadge[];
  icp: { name: string; link: string };
  moeIcp: { name: string; link: string };
}

export interface SiteSettingsMusic {
  /** 网易云歌单 ID，优先使用。 */
  playlistId: string;
  /** 歌单为空时使用的歌曲 ID 列表。 */
  trackIds: string[];
}

export interface SiteSettings {
  profile: SiteSettingsProfile;
  appearance: SiteSettingsAppearance;
  share: SiteSettingsShare;
  content: SiteSettingsContent;
  music: SiteSettingsMusic;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const BADGE_COLOR = /^[a-z0-9 /:-]*$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

function optionalText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

/** 站内路径、协议相对或 http(s) 绝对地址；其余（javascript:、data: 等）一律丢弃。 */
export function isSafeAssetUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith("//")) return true;
  return trimmed.startsWith("/");
}

/** ICP 备案这类可点击外链，允许留空。 */
export function isSafeSettingsLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/");
}

function assetUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, SITE_SETTINGS_LIMITS.image);
  if (!trimmed) return fallback;
  return isSafeAssetUrl(trimmed) ? trimmed : fallback;
}

function link(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, SITE_SETTINGS_LIMITS.url);
  if (!isSafeSettingsLink(trimmed)) return fallback;
  return trimmed;
}

function assetList(value: unknown, fallback: string[], max: number): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, SITE_SETTINGS_LIMITS.image);
    if (!trimmed || seen.has(trimmed) || !isSafeAssetUrl(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= max) break;
  }
  return result.length > 0 ? result : [...fallback];
}

function colorList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const colors = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => HEX_COLOR.test(item))
    .slice(0, SITE_SETTINGS_LIMITS.themeColors);
  return colors.length >= 2 ? colors : [...fallback];
}

function musicIds(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const raw = typeof item === "number" ? String(item) : item;
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().slice(0, SITE_SETTINGS_LIMITS.musicId);
    if (!/^\d+$/.test(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= SITE_SETTINGS_LIMITS.musicTrackIds) break;
  }
  return result.length > 0 ? result : [...fallback];
}

function badges(
  value: unknown,
  fallback: SiteSettingsFooterBadge[],
): SiteSettingsFooterBadge[] {
  if (!Array.isArray(value)) return fallback.map((item) => ({ ...item }));
  const result: SiteSettingsFooterBadge[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name = optionalText(item.name, "", SITE_SETTINGS_LIMITS.badgeName);
    const color = optionalText(item.color, "", SITE_SETTINGS_LIMITS.badgeColor);
    if (!name || !BADGE_COLOR.test(color)) continue;
    result.push({ name, color });
    if (result.length >= SITE_SETTINGS_LIMITS.footerBadges) break;
  }
  return result.length > 0 ? result : fallback.map((entry) => ({ ...entry }));
}

/** 出厂默认值：全部来自 siteConfig，后台未配置时即按此渲染。 */
export function createDefaultSiteSettings(): SiteSettings {
  return {
    profile: {
      siteTitle: siteConfig.title,
      authorName: siteConfig.authorName,
      bio: siteConfig.bio,
      avatarUrl: siteConfig.avatarUrl,
      buildDate: siteConfig.buildDate,
      social: { ...siteConfig.social },
    },
    appearance: {
      useGradient: siteConfig.useGradient,
      themeColors: [...siteConfig.themeColors],
      bgImages: [...siteConfig.bgImages],
      defaultPostCover: siteConfig.defaultPostCover,
    },
    share: {
      image: siteConfig.shareImage,
      card: siteConfig.shareCard,
    },
    content: {
      chatterTitle: siteConfig.chatterTitle,
      chatterDescription: siteConfig.chatterDescription,
      footerBadges: siteConfig.footerBadges.map((item) => ({ ...item })),
      icp: { ...siteConfig.icpConfig },
      moeIcp: { ...siteConfig.moeIcpConfig },
    },
    music: {
      playlistId: siteConfig.cloudMusicPlaylistId,
      trackIds: [...siteConfig.cloudMusicIds],
    },
  };
}

/**
 * 把数据库里的原始值（JSON 字符串 / 对象 / 残缺结构）归一化成一份完整配置。
 *
 * 约定：任何非法或缺失的字段都回落到出厂默认值，永不抛错——前台因为一条
 * 脏配置渲染失败比显示默认值糟糕得多。
 */
export function parseSiteSettings(raw: unknown): SiteSettings {
  const defaults = createDefaultSiteSettings();

  let parsed = raw;
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) return defaults;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return defaults;
    }
  }
  if (!isRecord(parsed)) return defaults;

  const profileRaw = isRecord(parsed.profile) ? parsed.profile : {};
  const socialRaw = isRecord(profileRaw.social) ? profileRaw.social : {};
  const appearanceRaw = isRecord(parsed.appearance) ? parsed.appearance : {};
  const shareRaw = isRecord(parsed.share) ? parsed.share : {};
  const contentRaw = isRecord(parsed.content) ? parsed.content : {};
  const icpRaw = isRecord(contentRaw.icp) ? contentRaw.icp : {};
  const moeIcpRaw = isRecord(contentRaw.moeIcp) ? contentRaw.moeIcp : {};
  const musicRaw = isRecord(parsed.music) ? parsed.music : {};

  const card: SiteShareCard =
    shareRaw.card === "summary" || shareRaw.card === "summary_large_image"
      ? shareRaw.card
      : defaults.share.card;

  return {
    profile: {
      siteTitle: text(
        profileRaw.siteTitle,
        defaults.profile.siteTitle,
        SITE_SETTINGS_LIMITS.siteTitle,
      ),
      authorName: text(
        profileRaw.authorName,
        defaults.profile.authorName,
        SITE_SETTINGS_LIMITS.authorName,
      ),
      bio: optionalText(
        profileRaw.bio,
        defaults.profile.bio,
        SITE_SETTINGS_LIMITS.bio,
      ),
      avatarUrl: assetUrl(profileRaw.avatarUrl, defaults.profile.avatarUrl),
      buildDate: text(
        profileRaw.buildDate,
        defaults.profile.buildDate,
        SITE_SETTINGS_LIMITS.buildDate,
      ),
      social: {
        github: link(socialRaw.github, defaults.profile.social.github),
        email: optionalText(
          socialRaw.email,
          defaults.profile.social.email,
          SITE_SETTINGS_LIMITS.socialValue,
        ),
        wechat: optionalText(
          socialRaw.wechat,
          defaults.profile.social.wechat,
          SITE_SETTINGS_LIMITS.socialValue,
        ),
        tg: link(socialRaw.tg, defaults.profile.social.tg),
      },
    },
    appearance: {
      useGradient:
        typeof appearanceRaw.useGradient === "boolean"
          ? appearanceRaw.useGradient
          : defaults.appearance.useGradient,
      themeColors: colorList(
        appearanceRaw.themeColors,
        defaults.appearance.themeColors,
      ),
      bgImages: assetList(
        appearanceRaw.bgImages,
        defaults.appearance.bgImages,
        SITE_SETTINGS_LIMITS.bgImages,
      ),
      defaultPostCover: assetUrl(
        appearanceRaw.defaultPostCover,
        defaults.appearance.defaultPostCover,
      ),
    },
    share: {
      image: assetUrl(shareRaw.image, defaults.share.image),
      card,
    },
    content: {
      chatterTitle: text(
        contentRaw.chatterTitle,
        defaults.content.chatterTitle,
        SITE_SETTINGS_LIMITS.chatterTitle,
      ),
      chatterDescription: optionalText(
        contentRaw.chatterDescription,
        defaults.content.chatterDescription,
        SITE_SETTINGS_LIMITS.chatterDescription,
      ),
      footerBadges: badges(contentRaw.footerBadges, defaults.content.footerBadges),
      icp: {
        name: optionalText(
          icpRaw.name,
          defaults.content.icp.name,
          SITE_SETTINGS_LIMITS.icpName,
        ),
        link: link(icpRaw.link, defaults.content.icp.link),
      },
      moeIcp: {
        name: optionalText(
          moeIcpRaw.name,
          defaults.content.moeIcp.name,
          SITE_SETTINGS_LIMITS.icpName,
        ),
        link: link(moeIcpRaw.link, defaults.content.moeIcp.link),
      },
    },
    music: {
      playlistId: optionalText(
        musicRaw.playlistId,
        defaults.music.playlistId,
        SITE_SETTINGS_LIMITS.musicId,
      ),
      trackIds: musicIds(musicRaw.trackIds, defaults.music.trackIds),
    },
  };
}
