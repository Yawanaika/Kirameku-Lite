import { asc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { siteConfig } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type {
  CreateSiteConfigInput,
  SiteConfigAdminItem,
  UpdateSiteConfigInput,
} from "./contracts";

export type PublicSiteConfig = Record<string, unknown>;

function parseValue(value: string | null): unknown {
  if (value === null) return "";
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toAdminItem(
  row: typeof siteConfig.$inferSelect,
): SiteConfigAdminItem {
  return {
    id: row.id,
    key: row.key,
    value: row.value ?? "",
    description: row.description ?? "",
    updated_at: row.updatedAt?.toISOString() ?? "",
  };
}

export function createSiteConfigService(db: AppDatabase) {
  async function loadAll(): Promise<SiteConfigAdminItem[]> {
    const rows = await db
      .select()
      .from(siteConfig)
      .orderBy(asc(siteConfig.id));
    return rows.map(toAdminItem);
  }

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

    listAll(): Promise<SiteConfigAdminItem[]> {
      return loadAll();
    },

    async create(input: CreateSiteConfigInput): Promise<SiteConfigAdminItem> {
      const [existing] = await db
        .select({ id: siteConfig.id })
        .from(siteConfig)
        .where(eq(siteConfig.key, input.key))
        .limit(1);
      if (existing) throw errors.badRequest(`配置 ${input.key} 已存在`);

      const [row] = await db
        .insert(siteConfig)
        .values({
          key: input.key,
          value: input.value,
          description: input.description,
        })
        .returning();
      if (!row) throw errors.internal("保存站点配置失败");
      return toAdminItem(row);
    },

    async update(
      key: string,
      input: UpdateSiteConfigInput,
    ): Promise<SiteConfigAdminItem> {
      const [existing] = await db
        .select({ id: siteConfig.id })
        .from(siteConfig)
        .where(eq(siteConfig.key, key))
        .limit(1);

      if (existing) {
        const values: Partial<typeof siteConfig.$inferInsert> = {
          value: input.value,
          updatedAt: new Date(),
        };
        if (input.description !== undefined) {
          values.description = input.description;
        }
        const [row] = await db
          .update(siteConfig)
          .set(values)
          .where(eq(siteConfig.key, key))
          .returning();
        if (!row) throw errors.internal("保存站点配置失败");
        return toAdminItem(row);
      }

      const [row] = await db
        .insert(siteConfig)
        .values({
          key,
          value: input.value,
          description: input.description ?? "",
        })
        .returning();
      if (!row) throw errors.internal("保存站点配置失败");
      return toAdminItem(row);
    },

    async batchUpdate(
      configs: Record<string, unknown>,
    ): Promise<SiteConfigAdminItem[]> {
      for (const [key, value] of Object.entries(configs)) {
        if (key.length === 0 || key.length > 100) {
          throw errors.badRequest("配置 key 长度必须在 1–100 之间");
        }
        const serialized = JSON.stringify(value);
        await db
          .insert(siteConfig)
          .values({ key, value: serialized, description: "" })
          .onConflictDoUpdate({
            target: siteConfig.key,
            set: { value: serialized, updatedAt: new Date() },
          });
      }
      return loadAll();
    },

    async remove(key: string): Promise<{ ok: true }> {
      const [row] = await db
        .delete(siteConfig)
        .where(eq(siteConfig.key, key))
        .returning({ id: siteConfig.id });
      if (!row) throw errors.notFound(`配置 ${key} 不存在`);
      return { ok: true };
    },
  };
}

export type SiteConfigService = ReturnType<typeof createSiteConfigService>;
