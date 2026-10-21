import { asc } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { siteConfig } from "@/server/db/schema";

export type PublicSiteConfig = Record<string, unknown>;

function parseValue(value: string | null): unknown {
  if (value === null) return "";
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function createSiteConfigService(db: AppDatabase) {
  return {
    async getPublic(): Promise<PublicSiteConfig> {
      const rows = await db
        .select({ key: siteConfig.key, value: siteConfig.value })
        .from(siteConfig)
        .orderBy(asc(siteConfig.id));

      const result: PublicSiteConfig = {};
      for (const row of rows) {
        result[row.key] = parseValue(row.value);
      }
      return result;
    },
  };
}

export type SiteConfigService = ReturnType<typeof createSiteConfigService>;
