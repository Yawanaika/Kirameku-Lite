import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import {
  notificationChannel,
  notificationLog,
  notificationRule,
} from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import {
  NOTIFICATION_EVENTS,
  getEventSpec,
  resolveThresholds,
  type EventSpec,
} from "./catalog";
import {
  CHANNEL_SPECS,
  CHANNEL_TYPES,
  SECRET_MASK,
  SECRET_UNCHANGED,
  requiredFields,
  secretFields,
  type ChannelConfig,
  type ChannelType,
  type ChannelView,
  type DeliveryOutcome,
  type InternalNotifyInput,
  type LogListQuery,
  type LogView,
  type NotificationLevel,
  type NotificationMessage,
  type NotificationsState,
  type NotifyResult,
  type RuleView,
  type ThresholdView,
  type UpdateChannelInput,
  type UpdateRuleInput,
} from "./contracts";
import { openSecret, sealSecret } from "./secrets";
import { sendTelegram } from "./channels/telegram";
import { sendEmail } from "./channels/email";
import { sendWebhook } from "./channels/webhook";
import { DeliveryError, sleep } from "./transport";

const CHANNEL_SENDERS: Record<
  ChannelType,
  (config: ChannelConfig, message: NotificationMessage) => Promise<void>
> = {
  telegram: sendTelegram,
  email: sendEmail,
  webhook: sendWebhook,
};

const MAX_ATTEMPTS = 3;
/** Keep the audit trail bounded so the table cannot grow without limit. */
const MAX_LOG_ROWS = 2000;

/** Rule state consumed by the ops checks in checks.ts. */
export interface RuleRuntimeState {
  enabled: boolean;
  channels: ChannelType[];
  thresholds: Record<string, number>;
  cooldownSeconds: number;
}

function parseConfig(value: string | null): ChannelConfig {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const config: ChannelConfig = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (typeof entry === "string") config[key] = entry;
      else if (typeof entry === "boolean") config[key] = entry;
      else if (typeof entry === "number") config[key] = String(entry);
    }
    return config;
  } catch {
    return {};
  }
}

function parseChannelList(value: string | null): ChannelType[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const types = parsed.filter((entry): entry is ChannelType =>
      CHANNEL_TYPES.includes(entry as ChannelType),
    );
    return [...new Set(types)];
  } catch {
    return [];
  }
}

function parseSettings(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function iso(value: Date | null | undefined): string {
  return value ? value.toISOString() : "";
}

function isFilled(config: ChannelConfig, key: string): boolean {
  const value = config[key];
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  return false;
}

function isConfigured(type: ChannelType, config: ChannelConfig): boolean {
  return requiredFields(type).every((key) => isFilled(config, key));
}

function levelOf(value: string | null): NotificationLevel {
  if (value === "info" || value === "warning" || value === "critical") {
    return value;
  }
  return "warning";
}

export function createNotificationsService(db: AppDatabase) {
  /** Insert the default channel / rule rows once; safe to call concurrently. */
  async function ensureDefaults(): Promise<void> {
    for (const type of CHANNEL_TYPES) {
      await db
        .insert(notificationChannel)
        .values({ type, enabled: false, config: "{}", updatedAt: new Date() })
        .onConflictDoNothing({ target: notificationChannel.type });
    }

    for (const spec of NOTIFICATION_EVENTS) {
      await db
        .insert(notificationRule)
        .values({
          eventKey: spec.key,
          enabled: true,
          channels: "[]",
          settings: "{}",
          cooldownSeconds: spec.cooldownSeconds,
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: notificationRule.eventKey });
    }
  }

  function toChannelView(
    row: typeof notificationChannel.$inferSelect | undefined,
    type: ChannelType,
  ): ChannelView {
    const spec = CHANNEL_SPECS[type];
    const stored = parseConfig(row?.config ?? null);
    const secrets = new Set(secretFields(type));

    const config: ChannelConfig = {};
    for (const [key, value] of Object.entries(stored)) {
      config[key] = secrets.has(key)
        ? value
          ? SECRET_MASK
          : ""
        : value;
    }

    return {
      type,
      label: spec.label,
      description: spec.description,
      enabled: row?.enabled === true,
      configured: isConfigured(type, stored),
      config,
      fields: spec.fields,
      updated_at: iso(row?.updatedAt),
    };
  }

  function toRuleView(
    spec: EventSpec,
    row: typeof notificationRule.$inferSelect | undefined,
  ): RuleView {
    const settings = row ? parseSettings(row.settings) : {};
    const numeric: Record<string, number> = {};
    for (const [key, value] of Object.entries(settings)) {
      const parsed = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(parsed)) numeric[key] = parsed;
    }
    const resolved = resolveThresholds(spec, numeric);
    const thresholds: ThresholdView[] = spec.thresholds.map((threshold) => ({
      key: threshold.key,
      label: threshold.label,
      kind: "number",
      min: threshold.min,
      max: threshold.max,
      step: threshold.step,
      default: threshold.default,
      help: threshold.help,
    }));

    return {
      event_key: spec.key,
      label: spec.label,
      description: spec.description,
      level: spec.level,
      enabled: row ? row.enabled === true : true,
      channels: parseChannelList(row?.channels ?? null),
      cooldown_seconds: row?.cooldownSeconds ?? spec.cooldownSeconds,
      settings: resolved,
      thresholds,
      last_fired_at: row?.lastFiredAt ? iso(row.lastFiredAt) : null,
    };
  }

  function toLogView(row: typeof notificationLog.$inferSelect): LogView {
    return {
      id: row.id,
      event_key: row.eventKey,
      level: row.level ?? "warning",
      title: row.title,
      body: row.body ?? "",
      channel_type: row.channelType ?? "",
      status: row.status,
      error: row.error ?? "",
      duration_ms: row.durationMs ?? null,
      created_at: iso(row.createdAt),
    };
  }

  async function writeLog(entry: {
    eventKey: string;
    level: string;
    title: string;
    body: string;
    channelType: string;
    status: "success" | "failed" | "skipped";
    error?: string;
    durationMs?: number;
  }): Promise<void> {
    await db.insert(notificationLog).values({
      eventKey: entry.eventKey,
      level: entry.level,
      title: entry.title.slice(0, 200),
      body: entry.body.slice(0, 2000),
      channelType: entry.channelType,
      status: entry.status,
      error: (entry.error ?? "").slice(0, 1000),
      durationMs: entry.durationMs ?? null,
      createdAt: new Date(),
    });
  }

  async function pruneLogs(): Promise<void> {
    await db.delete(notificationLog).where(
      sql`${notificationLog.id} <= (SELECT "id" FROM "notification_log" ORDER BY "id" DESC LIMIT 1 OFFSET ${MAX_LOG_ROWS})`,
    );
  }

  async function sendOnce(
    type: ChannelType,
    config: ChannelConfig,
    message: NotificationMessage,
  ): Promise<{ ok: boolean; error?: string; durationMs: number }> {
    const startedAt = Date.now();
    try {
      await CHANNEL_SENDERS[type](config, message);
      return { ok: true, durationMs: Date.now() - startedAt };
    } catch (error) {
      const retryable = error instanceof DeliveryError && error.retryable;
      let lastError =
        error instanceof Error ? error.message : String(error);

      if (retryable) {
        for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt += 1) {
          await sleep(400 * 3 ** (attempt - 2));
          try {
            await CHANNEL_SENDERS[type](config, message);
            return { ok: true, durationMs: Date.now() - startedAt };
          } catch (retryError) {
            lastError =
              retryError instanceof Error
                ? retryError.message
                : String(retryError);
            if (!(retryError instanceof DeliveryError && retryError.retryable)) {
              break;
            }
          }
        }
      }

      return {
        ok: false,
        error: lastError,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  async function loadChannelRows() {
    const rows = await db.select().from(notificationChannel);
    const map = new Map<ChannelType, typeof notificationChannel.$inferSelect>();
    for (const row of rows) {
      if (CHANNEL_TYPES.includes(row.type as ChannelType)) {
        map.set(row.type as ChannelType, row);
      }
    }
    return map;
  }

  async function deliver(
    message: NotificationMessage,
    targets: ChannelType[],
  ): Promise<DeliveryOutcome[]> {
    const channels = await loadChannelRows();
    const outcomes: DeliveryOutcome[] = [];

    for (const type of targets) {
      const row = channels.get(type);
      if (!row || row.enabled !== true) continue;

      const stored = parseConfig(row.config);
      if (!isConfigured(type, stored)) continue;

      const config: ChannelConfig = {};
      for (const [key, value] of Object.entries(stored)) {
        config[key] = secretFields(type).includes(key)
          ? openSecret(String(value))
          : value;
      }

      const result = await sendOnce(type, config, message);
      outcomes.push({
        channel: type,
        ok: result.ok,
        error: result.error,
        duration_ms: result.durationMs,
      });

      await writeLog({
        eventKey: message.eventKey,
        level: message.level,
        title: message.title,
        body: message.body,
        channelType: type,
        status: result.ok ? "success" : "failed",
        error: result.error,
        durationMs: result.durationMs,
      });
    }

    return outcomes;
  }

  async function loadRule(eventKey: string) {
    const [row] = await db
      .select()
      .from(notificationRule)
      .where(eq(notificationRule.eventKey, eventKey))
      .limit(1);
    return row;
  }

  return {
    ensureDefaults,

    async getState(): Promise<NotificationsState> {
      await ensureDefaults();

      const channelRows = await loadChannelRows();
      const channels = CHANNEL_TYPES.map((type) =>
        toChannelView(channelRows.get(type), type),
      );

      const ruleRows = await db.select().from(notificationRule);
      const rules = NOTIFICATION_EVENTS.map((spec) =>
        toRuleView(
          spec,
          ruleRows.find((row) => row.eventKey === spec.key),
        ),
      );

      const logs = await db
        .select()
        .from(notificationLog)
        .orderBy(desc(notificationLog.id))
        .limit(20);

      const [totalRow] = await db
        .select({ value: sql<number>`count(*)` })
        .from(notificationLog);

      return {
        channels,
        rules,
        logs: logs.map(toLogView),
        log_total: Number(totalRow?.value ?? 0),
      };
    },

    async getRuleState(eventKey: string): Promise<RuleRuntimeState | null> {
      const spec = getEventSpec(eventKey);
      if (!spec) return null;
      await ensureDefaults();
      const row = await loadRule(eventKey);
      const view = toRuleView(spec, row);
      return {
        enabled: view.enabled,
        channels: view.channels,
        thresholds: view.settings,
        cooldownSeconds: view.cooldown_seconds,
      };
    },

    async updateChannel(
      type: ChannelType,
      input: UpdateChannelInput,
    ): Promise<ChannelView> {
      await ensureDefaults();
      const existing = (await loadChannelRows()).get(type);
      if (!existing) throw errors.internal(`初始化 ${type} 通道失败`);

      const stored = parseConfig(existing.config);
      const secrets = secretFields(type);
      const allowed = new Set(
        CHANNEL_SPECS[type].fields.map((field) => field.key),
      );

      const next: ChannelConfig = { ...stored };
      for (const [key, raw] of Object.entries(input.config ?? {})) {
        if (!allowed.has(key)) continue;
        const value = typeof raw === "boolean" ? raw : String(raw).trim();

        if (typeof value === "string" && value === "") {
          delete next[key];
          continue;
        }
        if (
          secrets.includes(key) &&
          (value === SECRET_MASK || value === SECRET_UNCHANGED)
        ) {
          continue;
        }
        next[key] =
          secrets.includes(key) && typeof value === "string"
            ? sealSecret(value)
            : value;
      }

      const enabled = input.enabled ?? existing.enabled === true;
      if (enabled) {
        const missing = requiredFields(type).filter(
          (key) => !isFilled(next, key),
        );
        if (missing.length > 0) {
          const labels = missing.map((key) => {
            const field = CHANNEL_SPECS[type].fields.find(
              (entry) => entry.key === key,
            );
            return field?.label ?? key;
          });
          throw errors.badRequest(
            `启用前请先填写：${labels.join("、")}`,
          );
        }
      }

      const [row] = await db
        .update(notificationChannel)
        .set({
          enabled,
          config: JSON.stringify(next),
          updatedAt: new Date(),
        })
        .where(eq(notificationChannel.type, type))
        .returning();
      if (!row) throw errors.internal("保存通知通道失败");
      return toChannelView(row, type);
    },

    async updateRule(
      eventKey: string,
      input: UpdateRuleInput,
    ): Promise<RuleView> {
      const spec = getEventSpec(eventKey);
      if (!spec) throw errors.notFound(`未知的预警事件 ${eventKey}`);
      await ensureDefaults();

      const existing = await loadRule(eventKey);
      if (!existing) throw errors.internal(`初始化规则 ${eventKey} 失败`);

      const values: Partial<typeof notificationRule.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.enabled !== undefined) values.enabled = input.enabled;
      if (input.channels !== undefined) {
        values.channels = JSON.stringify([...new Set(input.channels)]);
      }
      if (input.cooldownSeconds !== undefined) {
        values.cooldownSeconds = input.cooldownSeconds;
      }
      if (input.settings !== undefined) {
        const merged = parseSettings(existing.settings);
        for (const threshold of spec.thresholds) {
          const raw = input.settings[threshold.key];
          if (raw === undefined) continue;
          const parsed = typeof raw === "number" ? raw : Number(raw);
          if (!Number.isFinite(parsed)) continue;
          merged[threshold.key] = Math.min(
            threshold.max,
            Math.max(threshold.min, parsed),
          );
        }
        values.settings = JSON.stringify(merged);
      }

      const [row] = await db
        .update(notificationRule)
        .set(values)
        .where(eq(notificationRule.eventKey, eventKey))
        .returning();
      if (!row) throw errors.internal("保存预警规则失败");
      return toRuleView(spec, row);
    },

    /**
     * Fan a message out to the matching channels. Applies the per-event
     * switch and cooldown unless the caller forces delivery.
     */
    async notify(
      input: InternalNotifyInput,
      options: { recordSkip?: boolean } = {},
    ): Promise<NotifyResult> {
      await ensureDefaults();
      const spec = getEventSpec(input.eventKey);
      const rule = await loadRule(input.eventKey);
      const cooldownSeconds =
        rule?.cooldownSeconds ?? spec?.cooldownSeconds ?? 0;

      if (rule && rule.enabled !== true) {
        if (options.recordSkip) {
          await writeLog({
            eventKey: input.eventKey,
            level: input.level,
            title: input.title,
            body: input.body,
            channelType: "",
            status: "skipped",
            error: "该预警事件已关闭",
          });
        }
        return {
          eventKey: input.eventKey,
          sent: false,
          skipped: "rule-disabled",
          reason: "该预警事件已关闭",
          outcomes: [],
        };
      }

      const targets =
        input.channels && input.channels.length > 0
          ? [...new Set(input.channels)]
          : parseChannelList(rule?.channels ?? null);

      if (targets.length === 0) {
        if (options.recordSkip) {
          await writeLog({
            eventKey: input.eventKey,
            level: input.level,
            title: input.title,
            body: input.body,
            channelType: "",
            status: "skipped",
            error: "没有为该事件选择推送渠道",
          });
        }
        return {
          eventKey: input.eventKey,
          sent: false,
          skipped: "no-channel",
          reason: "没有为该事件选择推送渠道",
          outcomes: [],
        };
      }

      if (!input.force && rule?.lastFiredAt && cooldownSeconds > 0) {
        const elapsedMs = Date.now() - rule.lastFiredAt.getTime();
        if (elapsedMs < cooldownSeconds * 1000) {
          const remaining = Math.ceil(
            (cooldownSeconds * 1000 - elapsedMs) / 1000,
          );
          return {
            eventKey: input.eventKey,
            sent: false,
            skipped: "cooldown",
            reason: `冷却中，还需等待 ${remaining} 秒`,
            outcomes: [],
          };
        }
      }

      const message: NotificationMessage = {
        eventKey: input.eventKey,
        level: input.level,
        title: input.title,
        body: input.body,
        fields: input.fields ?? [],
        timestamp: new Date().toISOString(),
        link: input.link,
      };

      const outcomes = await deliver(message, targets);
      const delivered = outcomes.some((outcome) => outcome.ok);

      if (delivered && rule) {
        await db
          .update(notificationRule)
          .set({ lastFiredAt: new Date() })
          .where(eq(notificationRule.eventKey, input.eventKey));
      }

      await pruneLogs();

      return {
        eventKey: input.eventKey,
        sent: delivered,
        reason:
          delivered
            ? undefined
            : outcomes.length === 0
              ? "没有可用的推送渠道（未启用或未配置完整）"
              : "所有渠道发送失败",
        outcomes,
      };
    },

    /** Send a one-off test message through the given channel. */
    async testChannel(type: ChannelType): Promise<DeliveryOutcome> {
      await ensureDefaults();
      const row = (await loadChannelRows()).get(type);
      if (!row) throw errors.notFound(`未知的通道 ${type}`);

      const stored = parseConfig(row.config);
      if (!isConfigured(type, stored)) {
        throw errors.badRequest("通道配置不完整，请先填写必填项");
      }

      const config: ChannelConfig = {};
      for (const [key, value] of Object.entries(stored)) {
        config[key] = secretFields(type).includes(key)
          ? openSecret(String(value))
          : value;
      }

      const message: NotificationMessage = {
        eventKey: "channel.test",
        level: "info",
        title: "测试通知",
        body: `这是一条来自 Kirameku 后台的测试消息，说明「${CHANNEL_SPECS[type].label}」通道配置可用。`,
        fields: [{ label: "通道", value: CHANNEL_SPECS[type].label }],
        timestamp: new Date().toISOString(),
      };

      const result = await sendOnce(type, config, message);
      await writeLog({
        eventKey: message.eventKey,
        level: message.level,
        title: message.title,
        body: message.body,
        channelType: type,
        status: result.ok ? "success" : "failed",
        error: result.error,
        durationMs: result.durationMs,
      });

      return {
        channel: type,
        ok: result.ok,
        error: result.error,
        duration_ms: result.durationMs,
      };
    },

    async listLogs(query: LogListQuery): Promise<{
      items: LogView[];
      total: number;
      page: number;
      size: number;
    }> {
      const filters = [];
      if (query.status) filters.push(eq(notificationLog.status, query.status));
      if (query.eventKey) {
        filters.push(eq(notificationLog.eventKey, query.eventKey));
      }
      const where = filters.length > 0 ? and(...filters) : undefined;

      const rows = where
        ? await db
            .select()
            .from(notificationLog)
            .where(where)
            .orderBy(desc(notificationLog.id))
            .limit(query.size)
            .offset((query.page - 1) * query.size)
        : await db
            .select()
            .from(notificationLog)
            .orderBy(desc(notificationLog.id))
            .limit(query.size)
            .offset((query.page - 1) * query.size);

      const [totalRow] = where
        ? await db
            .select({ value: sql<number>`count(*)` })
            .from(notificationLog)
            .where(where)
        : await db
            .select({ value: sql<number>`count(*)` })
            .from(notificationLog);

      return {
        items: rows.map(toLogView),
        total: Number(totalRow?.value ?? 0),
        page: query.page,
        size: query.size,
      };
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
