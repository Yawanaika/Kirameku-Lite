import { z } from "zod";
import {
  isSafeAssetUrl,
  isSafeSettingsLink,
  isSiteUrl,
  SITE_SETTINGS_LIMITS,
} from "@/lib/site-settings";

/**
 * 站点配置的写入校验。
 *
 * 值存在 site_config（key = site_settings）里，但走专用的
 * /api/admin/site-settings 路由，保存前就能拒绝危险协议、非法颜色和超量条目。
 */
const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label}不能为空`).max(max, `${label}最多 ${max} 个字符`);

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label}最多 ${max} 个字符`).default("");

const assetUrl = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}不能为空`)
    .max(SITE_SETTINGS_LIMITS.image, `${label}最多 ${SITE_SETTINGS_LIMITS.image} 个字符`)
    .refine(
      (value) => isSafeAssetUrl(value),
      `${label}需要以 / 开头，或使用 http(s):// 绝对地址`,
    );

const settingsLink = (label: string) =>
  z
    .string()
    .trim()
    .max(SITE_SETTINGS_LIMITS.url, `${label}最多 ${SITE_SETTINGS_LIMITS.url} 个字符`)
    .default("")
    .refine(
      (value) => isSafeSettingsLink(value),
      `${label}需要留空、以 / 开头，或使用 http(s)://`,
    );

const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, "颜色需要写成 #a18cd1 这样的十六进制");

export const siteSettingsInput = z.object({
  profile: z.object({
    siteTitle: requiredText(SITE_SETTINGS_LIMITS.siteTitle, "站点标题"),
    url: z
      .string()
      .trim()
      .max(
        SITE_SETTINGS_LIMITS.url,
        `站点地址最多 ${SITE_SETTINGS_LIMITS.url} 个字符`,
      )
      .default("")
      .refine(
        (value) => isSiteUrl(value),
        "站点地址需要留空，或写成 https://example.com 这样的绝对地址",
      ),
    authorName: requiredText(SITE_SETTINGS_LIMITS.authorName, "昵称"),
    bio: optionalText(SITE_SETTINGS_LIMITS.bio, "简介"),
    avatarUrl: assetUrl("头像地址"),
    buildDate: requiredText(SITE_SETTINGS_LIMITS.buildDate, "建站时间"),
    social: z.object({
      github: settingsLink("GitHub 地址"),
      email: optionalText(SITE_SETTINGS_LIMITS.socialValue, "邮箱"),
      wechat: optionalText(SITE_SETTINGS_LIMITS.socialValue, "微信"),
      tg: settingsLink("Telegram 地址"),
    }),
  }),
  appearance: z.object({
    useGradient: z.boolean().default(false),
    themeColors: z
      .array(hexColor)
      .min(2, "至少需要 2 个渐变颜色")
      .max(SITE_SETTINGS_LIMITS.themeColors, `最多 ${SITE_SETTINGS_LIMITS.themeColors} 个颜色`),
    bgImages: z
      .array(assetUrl("背景图"))
      .min(1, "至少需要 1 张背景图")
      .max(SITE_SETTINGS_LIMITS.bgImages, `最多 ${SITE_SETTINGS_LIMITS.bgImages} 张背景图`),
    defaultPostCover: assetUrl("默认封面"),
  }),
  share: z.object({
    image: assetUrl("分享图片"),
    card: z.enum(["summary", "summary_large_image"]).default("summary_large_image"),
  }),
  content: z.object({
    chatterTitle: requiredText(SITE_SETTINGS_LIMITS.chatterTitle, "留言板标题"),
    chatterDescription: optionalText(
      SITE_SETTINGS_LIMITS.chatterDescription,
      "留言板描述",
    ),
    footerBadges: z
      .array(
        z.object({
          name: requiredText(SITE_SETTINGS_LIMITS.badgeName, "徽标名称"),
          color: z
            .string()
            .trim()
            .max(SITE_SETTINGS_LIMITS.badgeColor)
            .regex(/^[a-z0-9 /:-]*$/i, "徽标颜色请填写 Tailwind 类名，例如 text-sky-500"),
        }),
      )
      .max(SITE_SETTINGS_LIMITS.footerBadges, `最多 ${SITE_SETTINGS_LIMITS.footerBadges} 个徽标`),
    icp: z.object({
      name: optionalText(SITE_SETTINGS_LIMITS.icpName, "备案号"),
      link: settingsLink("备案链接"),
    }),
    moeIcp: z.object({
      name: optionalText(SITE_SETTINGS_LIMITS.icpName, "萌备案号"),
      link: settingsLink("萌备案链接"),
    }),
  }),
  music: z.object({
    playlistId: optionalText(SITE_SETTINGS_LIMITS.musicId, "歌单 ID"),
    trackIds: z
      .array(z.string().trim().regex(/^\d+$/, "歌曲 ID 只能是数字"))
      .max(SITE_SETTINGS_LIMITS.musicTrackIds, `最多 ${SITE_SETTINGS_LIMITS.musicTrackIds} 首歌曲`),
  }),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsInput>;
