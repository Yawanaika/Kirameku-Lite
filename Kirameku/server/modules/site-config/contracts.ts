import { z } from "zod";
import {
  isSafeHref,
  NAV_DROPDOWN_MAX_LINKS,
  navDropdownIconNames,
} from "@/lib/nav-dropdown";

export const siteConfigKey = z.string().trim().min(1).max(100);

export const createSiteConfigInput = z.object({
  key: siteConfigKey,
  value: z.string().default(""),
  description: z.string().trim().max(500).default(""),
});

export const updateSiteConfigInput = z.object({
  value: z.string(),
  description: z.string().trim().max(500).optional(),
});

export const batchSiteConfigInput = z
  .record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length <= 200, {
    message: "一次最多更新 200 项配置",
  });

export const siteConfigKeyParams = z.object({
  key: siteConfigKey,
});

export type CreateSiteConfigInput = z.infer<typeof createSiteConfigInput>;
export type UpdateSiteConfigInput = z.infer<typeof updateSiteConfigInput>;

export interface SiteConfigAdminItem {
  id: number;
  key: string;
  value: string;
  description: string;
  updated_at: string;
}
/**
 * 导航栏自定义下拉菜单的写入校验。
 *
 * 值本身存在 site_config（key = nav_dropdown）里，但走专用的 /api/admin/nav-dropdown
 * 路由，这样后台保存前就能拒绝空名称、危险协议和超量条目。
 */
export const navDropdownLinkInput = z.object({
  label: z.string().trim().min(1, "链接名称不能为空").max(60, "链接名称最多 60 个字符"),
  href: z
    .string()
    .trim()
    .min(1, "链接地址不能为空")
    .max(500, "链接地址最多 500 个字符")
    .refine(
      (value) => isSafeHref(value),
      "链接地址需要以 / 开头，或使用 http(s)://、mailto:、tel:",
    ),
  description: z.string().trim().max(160, "说明最多 160 个字符").default(""),
});

export const navDropdownConfigInput = z.object({
  enabled: z.boolean().default(true),
  label: z
    .string()
    .trim()
    .min(1, "菜单名称不能为空")
    .max(40, "菜单名称最多 40 个字符")
    .default("更多"),
  icon: z.enum(navDropdownIconNames).default("link"),
  links: z
    .array(navDropdownLinkInput)
    .max(NAV_DROPDOWN_MAX_LINKS, `最多配置 ${NAV_DROPDOWN_MAX_LINKS} 个链接`)
    .default([]),
});

export type NavDropdownConfigInput = z.infer<typeof navDropdownConfigInput>;
