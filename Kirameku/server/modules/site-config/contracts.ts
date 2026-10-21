import { z } from "zod";

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
