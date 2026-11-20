import "server-only";
import { eq } from "drizzle-orm";
import { env } from "@/server/env";
import { getDb } from "@/server/db/client";
import { imagebedSettings } from "@/server/db/schema/imagebed";
import { errors } from "@/server/http/errors";
import type { ImagebedRuntimeConfig, ImagebedSettingsInput, ImagebedSettingsView } from "./contracts";
import { IMAGEBED_CHANNEL, normalizeImagebedBaseUrl } from "./contracts";
import { decryptImagebedToken, encryptImagebedToken } from "./secrets";

async function loadRow() {
  const [row] = await getDb().select().from(imagebedSettings).where(eq(imagebedSettings.id, 1)).limit(1);
  if (!row) throw errors.internal("图床配置尚未初始化，请先运行数据库迁移");
  return row;
}

function viewOf(row: Awaited<ReturnType<typeof loadRow>>): ImagebedSettingsView {
  return {
    enabled: row.enabled,
    baseUrl: row.baseUrl,
    uploadChannel: IMAGEBED_CHANNEL,
    uploadFolder: row.uploadFolder,
    tokenConfigured: row.apiToken.length > 0,
  };
}

export async function getImagebedSettings(): Promise<ImagebedSettingsView> {
  return viewOf(await loadRow());
}

export async function saveImagebedSettings(input: ImagebedSettingsInput): Promise<ImagebedSettingsView> {
  const current = await loadRow();
  if (input.clearApiToken && input.apiToken) {
    throw errors.validation("清除 Token 时不能同时提交新 Token");
  }
  const apiToken = input.clearApiToken
    ? ""
    : input.apiToken
      ? encryptImagebedToken(input.apiToken)
      : current.apiToken;
  const enabled = input.clearApiToken ? false : input.enabled;
  const baseUrl = normalizeImagebedBaseUrl(input.baseUrl);
  if (enabled) {
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
      throw errors.validation("请先配置至少 32 个字符的 AUTH_SECRET，再启用图床");
    }
    if (!baseUrl || !apiToken) {
      throw errors.validation("启用图床前必须填写服务地址和 API Token");
    }
    if (!apiToken.startsWith("enc:v1:")) {
      throw errors.validation("图床 Token 未安全加密，请重新填写 Token");
    }
  }

  const [updated] = await getDb()
    .update(imagebedSettings)
    .set({
      enabled,
      baseUrl,
      apiToken,
      uploadChannel: IMAGEBED_CHANNEL,
      uploadFolder: input.uploadFolder,
      updatedAt: new Date(),
    })
    .where(eq(imagebedSettings.id, 1))
    .returning();
  if (!updated) throw errors.internal("保存图床设置失败");
  return viewOf(updated);
}

export async function getImagebedRuntimeConfig(): Promise<ImagebedRuntimeConfig | null> {
  const row = await loadRow();
  if (!row.enabled) return null;
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
    throw errors.validation("AUTH_SECRET 未配置或长度不足，图床已暂停使用");
  }
  if (!row.baseUrl || !row.apiToken) {
    throw errors.conflict("图床已启用，但服务地址或 API Token 尚未配置");
  }
  return {
    baseUrl: normalizeImagebedBaseUrl(row.baseUrl),
    apiToken: decryptImagebedToken(row.apiToken),
    uploadFolder: row.uploadFolder,
  };
}
