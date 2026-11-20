import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";

const databaseHolder = vi.hoisted(() => ({ database: null as unknown }));

vi.mock("@/server/db/client", () => ({
  getDb: () => databaseHolder.database,
}));

import { getImagebedRuntimeConfig, getImagebedSettings, saveImagebedSettings } from "./service";

let directory: string;
let connection: DatabaseConnection;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-imagebed-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  databaseHolder.database = drizzle(connection, { schema });
});

afterEach(() => {
  connection?.close();
  databaseHolder.database = null;
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("imagebed settings service", () => {
  it("encrypts tokens, exposes only configured state, and preserves a token on blank updates", async () => {
    const initial = await getImagebedSettings();
    expect(initial).toMatchObject({ enabled: false, tokenConfigured: false, uploadChannel: "telegram" });
    expect(initial).not.toHaveProperty("apiToken");

    const settings = {
      enabled: true,
      baseUrl: "https://images.example.test",
      uploadChannel: "telegram" as const,
      uploadFolder: "blog/images",
      apiToken: "private-api-token",
      clearApiToken: false,
    };
    const saved = await saveImagebedSettings(settings);
    expect(saved).toMatchObject({ enabled: true, baseUrl: settings.baseUrl, tokenConfigured: true });
    expect(saved).not.toHaveProperty("apiToken");

    const stored = connection.prepare('SELECT "api_token" AS token FROM "imagebed_settings" WHERE "id" = 1').get() as { token: string };
    expect(stored.token).toMatch(/^enc:v1:/);
    expect(stored.token).not.toContain(settings.apiToken);
    await expect(getImagebedRuntimeConfig()).resolves.toEqual({
      baseUrl: settings.baseUrl,
      apiToken: settings.apiToken,
      uploadFolder: settings.uploadFolder,
    });

    await saveImagebedSettings({ ...settings, apiToken: "" });
    expect((connection.prepare('SELECT "api_token" AS token FROM "imagebed_settings" WHERE "id" = 1').get() as { token: string }).token).toBe(stored.token);
  });

  it("clears the token and disables the backend only on explicit request", async () => {
    const settings = {
      enabled: true,
      baseUrl: "https://images.example.test",
      uploadChannel: "telegram" as const,
      uploadFolder: "",
      apiToken: "private-api-token",
      clearApiToken: false,
    };
    await saveImagebedSettings(settings);
    const cleared = await saveImagebedSettings({ ...settings, apiToken: "", clearApiToken: true });

    expect(cleared).toMatchObject({ enabled: false, tokenConfigured: false });
    await expect(getImagebedRuntimeConfig()).resolves.toBeNull();
    expect((connection.prepare('SELECT "api_token" AS token FROM "imagebed_settings" WHERE "id" = 1').get() as { token: string }).token).toBe("");
  });
});
