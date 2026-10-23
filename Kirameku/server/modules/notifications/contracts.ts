import { z } from "zod";

export const CHANNEL_TYPES = ["telegram", "email", "webhook"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const NOTIFICATION_LEVELS = ["info", "warning", "critical"] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

/** Returned instead of a stored secret; never contains the real value. */
export const SECRET_MASK = "__SET__";
/** Client sends this back to keep the stored secret untouched. */
export const SECRET_UNCHANGED = "__UNCHANGED__";

export interface ChannelFieldSpec {
  key: string;
  label: string;
  kind: "text" | "password" | "number" | "switch" | "textarea";
  placeholder?: string;
  help?: string;
  required?: boolean;
  /** Stored encrypted; never returned by the API. */
  secret?: boolean;
  default?: string | boolean;
}

export interface ChannelSpec {
  type: ChannelType;
  label: string;
  description: string;
  fields: ChannelFieldSpec[];
}

/**
 * Single source of truth for what each channel needs. The admin UI renders the
 * form from these specs and the service validates saved configs with them.
 */
export const CHANNEL_SPECS: Record<ChannelType, ChannelSpec> = {
  telegram: {
    type: "telegram",
    label: "Telegram Bot",
    description:
      "通过 Bot API 把预警发到私聊、群或频道。用 @BotFather 创建 bot，再把 bot 拉进目标会话。",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        kind: "password",
        secret: true,
        required: true,
        placeholder: "123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        help: "在 @BotFather 用 /newbot 或 /token 获取；保存后不再回显。",
      },
      {
        key: "chatId",
        label: "Chat ID",
        kind: "text",
        required: true,
        placeholder: "-1001234567890",
        help: "私聊是用户 ID，群/频道是负数 ID；可先给 bot 发消息后用 getUpdates 查看。",
      },
      {
        key: "messageThreadId",
        label: "话题 ID",
        kind: "text",
        placeholder: "可选",
        help: "超级群的话题（topic）ID，留空即发到主话题。",
      },
      {
        key: "silent",
        label: "静默发送",
        kind: "switch",
        help: "开启后消息不响铃、不弹通知。",
        default: false,
      },
    ],
  },
  email: {
    type: "email",
    label: "邮件（SMTP）",
    description:
      "通过 SMTP 服务器发送预警邮件，支持 SSL/TLS 与登录认证。",
    fields: [
      {
        key: "host",
        label: "SMTP 主机",
        kind: "text",
        required: true,
        placeholder: "smtp.qq.com",
      },
      {
        key: "port",
        label: "端口",
        kind: "number",
        placeholder: "465",
        help: "465 一般配合 SSL 直连，587 走 STARTTLS。",
        default: "465",
      },
      {
        key: "secure",
        label: "SSL/TLS 直连",
        kind: "switch",
        help: "端口 465 时开启；587 请关闭（自动 STARTTLS）。",
        default: true,
      },
      {
        key: "user",
        label: "登录账号",
        kind: "text",
        placeholder: "you@example.com",
      },
      {
        key: "pass",
        label: "登录密码 / 授权码",
        kind: "password",
        secret: true,
        help: "QQ/163 等邮箱请使用「授权码」而不是登录密码；保存后不再回显。",
      },
      {
        key: "from",
        label: "发件人",
        kind: "text",
        required: true,
        placeholder: "Kirameku <you@example.com>",
      },
      {
        key: "to",
        label: "收件人",
        kind: "text",
        required: true,
        placeholder: "admin@example.com, ops@example.com",
        help: "多个地址用英文逗号分隔。",
      },
    ],
  },
  webhook: {
    type: "webhook",
    label: "Webhook",
    description:
      "把预警以 JSON POST 到任意 HTTP 接口，可带 HMAC-SHA256 签名，方便接入飞书/钉钉/n8n/自建服务。",
    fields: [
      {
        key: "url",
        label: "回调地址",
        kind: "text",
        required: true,
        placeholder: "https://example.com/hooks/kirameku",
      },
      {
        key: "secret",
        label: "签名密钥",
        kind: "password",
        secret: true,
        placeholder: "可选",
        help: "设置后请求头带 x-kirameku-signature: sha256=<HMAC(原始 body)>。",
      },
      {
        key: "headers",
        label: "附加请求头",
        kind: "textarea",
        placeholder: '{"Authorization":"Bearer xxx"}',
        help: "JSON 对象，可选；用于鉴权头等自定义字段。",
      },
    ],
  },
};

/** Fields whose stored value is encrypted and masked in API responses. */
export function secretFields(type: ChannelType): string[] {
  return CHANNEL_SPECS[type].fields
    .filter((field) => field.secret)
    .map((field) => field.key);
}

export function requiredFields(type: ChannelType): string[] {
  return CHANNEL_SPECS[type].fields
    .filter((field) => field.required)
    .map((field) => field.key);
}

const channelConfigValue = z.union([
  z.string().max(4000),
  z.number(),
  z.boolean(),
]);

export const channelTypeParams = z.object({
  type: z.enum(CHANNEL_TYPES),
});

export const updateChannelInput = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.string().max(40), channelConfigValue).optional(),
});

export const ruleEventParams = z.object({
  eventKey: z.string().trim().min(1).max(80),
});

export const updateRuleInput = z.object({
  enabled: z.boolean().optional(),
  channels: z.array(z.enum(CHANNEL_TYPES)).max(CHANNEL_TYPES.length).optional(),
  cooldownSeconds: z.coerce.number().int().min(0).max(86_400).optional(),
  settings: z
    .record(
      z.string().max(60),
      z.union([z.string().max(60), z.coerce.number()]),
    )
    .optional(),
});

export const dispatchInput = z.object({
  level: z.enum(NOTIFICATION_LEVELS).default("info"),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(4000).default(""),
  channels: z.array(z.enum(CHANNEL_TYPES)).min(1).optional(),
});

export const internalNotifyInput = dispatchInput.extend({
  eventKey: z.string().trim().min(1).max(80).default("custom"),
  force: z.boolean().default(false),
  fields: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        value: z.string().max(500),
      }),
    )
    .max(20)
    .default([]),
  link: z.string().max(500).optional(),
});

export const logListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["success", "failed", "skipped"]).optional(),
  eventKey: z.string().trim().max(80).optional(),
});

export type UpdateChannelInput = z.infer<typeof updateChannelInput>;
export type UpdateRuleInput = z.infer<typeof updateRuleInput>;
export type DispatchInput = z.infer<typeof dispatchInput>;
export type InternalNotifyInput = z.infer<typeof internalNotifyInput>;
export type LogListQuery = z.infer<typeof logListQuery>;

export interface NotificationMessage {
  eventKey: string;
  level: NotificationLevel;
  title: string;
  body: string;
  fields: { label: string; value: string }[];
  timestamp: string;
  link?: string;
}

export type ChannelConfig = Record<string, string | boolean>;

export interface ChannelView {
  type: ChannelType;
  label: string;
  description: string;
  enabled: boolean;
  /** Every required field has a value; the channel can actually deliver. */
  configured: boolean;
  /** Secrets are replaced with SECRET_MASK. */
  config: ChannelConfig;
  fields: ChannelFieldSpec[];
  updated_at: string;
}

export interface ThresholdView {
  key: string;
  label: string;
  kind: "number";
  min: number;
  max: number;
  step: number;
  default: number;
  help?: string;
}

export interface RuleView {
  event_key: string;
  label: string;
  description: string;
  level: NotificationLevel;
  enabled: boolean;
  channels: ChannelType[];
  cooldown_seconds: number;
  settings: Record<string, number>;
  thresholds: ThresholdView[];
  last_fired_at: string | null;
}

export interface LogView {
  id: number;
  event_key: string;
  level: string;
  title: string;
  body: string;
  channel_type: string;
  status: string;
  error: string;
  duration_ms: number | null;
  created_at: string;
}

export interface NotificationsState {
  channels: ChannelView[];
  rules: RuleView[];
  logs: LogView[];
  log_total: number;
}

export interface DeliveryOutcome {
  channel: ChannelType;
  ok: boolean;
  error?: string;
  duration_ms: number;
}

export interface NotifyResult {
  eventKey: string;
  sent: boolean;
  skipped?: "rule-disabled" | "cooldown" | "no-channel";
  reason?: string;
  outcomes: DeliveryOutcome[];
}
