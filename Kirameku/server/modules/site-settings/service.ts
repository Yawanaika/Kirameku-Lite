import "server-only";
import { parseSiteSettings, type SiteSettings } from "@/lib/site-settings";
import { SITE_SETTINGS_CONFIG_KEY } from "@/lib/site-settings";
import { logError } from "@/server/http/logger";
import { getSiteConfigService } from "@/server/modules/site-config";
import type { SiteSettingsInput } from "./contracts";

export const SITE_SETTINGS_DESCRIPTION = "站点信息 / 外观 / 分享 / 内容 / 云音乐（JSON）";

/**
 * 读取后台保存的站点配置。
 *
 * 任何异常（数据库不存在、表还没建、JSON 脏了）都回落到出厂默认值：这些配置
 * 会在构建期和每个前台页面的渲染期被读取，让它抛错等于整站白屏。
 */
export async function loadSiteSettings(): Promise<SiteSettings> {
  try {
    const config = await getSiteConfigService().getPublic();
    return parseSiteSettings(config[SITE_SETTINGS_CONFIG_KEY]);
  } catch (error) {
    logError("Failed to load site settings, falling back to defaults", error);
    return parseSiteSettings(undefined);
  }
}

/** 归一化并落库，返回最终生效的配置。 */
export async function saveSiteSettings(
  input: SiteSettingsInput,
): Promise<SiteSettings> {
  const settings = parseSiteSettings(input);
  await getSiteConfigService().update(SITE_SETTINGS_CONFIG_KEY, {
    value: JSON.stringify(settings),
    description: SITE_SETTINGS_DESCRIPTION,
  });
  return settings;
}
