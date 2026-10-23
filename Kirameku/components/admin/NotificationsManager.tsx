"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  SendHorizonal,
  Webhook,
} from "lucide-react";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import { adminRequest, describeAdminError } from "./admin-api";
import { formatDateTime } from "./format";
import { useAdminData } from "./use-admin-data";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  CHANNEL_TYPES,
  NOTIFICATION_LEVELS,
  type ChannelFieldSpec,
  type ChannelType,
  type ChannelView,
  type DeliveryOutcome,
  type LogView,
  type NotificationLevel,
  type NotificationsState,
  type RuleView,
} from "@/server/modules/notifications/contracts";

interface SchedulerStatus {
  active: boolean;
  interval_minutes: number;
  run_count: number;
  last_run_at: string | null;
  last_error: string | null;
  last_triggered: string[];
}

type NotificationsResponse = NotificationsState & {
  scheduler: SchedulerStatus;
};

const CHANNEL_ICONS = {
  telegram: MessageCircle,
  email: Mail,
  webhook: Webhook,
} satisfies Record<ChannelType, typeof Mail>;

const LEVEL_LABELS: Record<NotificationLevel, string> = {
  info: "提示",
  warning: "警告",
  critical: "严重",
};

function levelText(value: string) {
  return LEVEL_LABELS[value as NotificationLevel] ?? value;
}

const LEVEL_VARIANTS: Record<string, BadgeProps["variant"]> = {
  info: "info",
  warning: "warning",
  critical: "danger",
};

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
  success: "success",
  failed: "danger",
  skipped: "muted",
};

const STATUS_LABELS: Record<string, string> = {
  success: "成功",
  failed: "失败",
  skipped: "跳过",
};

function initialValues(channel: ChannelView) {
  const values: Record<string, string | boolean> = {};
  for (const field of channel.fields) {
    const stored = channel.config[field.key];
    if (field.kind === "switch") {
      values[field.key] =
        typeof stored === "boolean"
          ? stored
          : field.default === true;
      continue;
    }
    if (field.secret) {
      // Stored secrets come back masked; keep the input empty so an
      // untouched field never overwrites the saved value.
      values[field.key] = "";
      continue;
    }
    values[field.key] = typeof stored === "string" ? stored : "";
  }
  return values;
}

function secretPlaceholder(field: ChannelFieldSpec, channel: ChannelView) {
  const stored = channel.config[field.key];
  if (typeof stored === "string" && stored.length > 0) {
    return "已保存，留空保持不变";
  }
  return field.placeholder ?? "";
}

function FieldInput({
  field,
  channel,
  value,
  onChange,
}: {
  field: ChannelFieldSpec;
  channel: ChannelView;
  value: string | boolean;
  onChange: (next: string | boolean) => void;
}) {
  if (field.kind === "switch") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={value === true}
        onClick={() => onChange(value !== true)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          value === true ? "bg-sky-400" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
            value === true ? "left-4.5" : "left-0.5"
          }`}
        />
      </button>
    );
  }

  if (field.kind === "textarea") {
    return (
      <Textarea
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <Input
      type={field.kind === "password" ? "password" : "text"}
      inputMode={field.kind === "number" ? "numeric" : undefined}
      value={typeof value === "string" ? value : ""}
      placeholder={
        field.secret ? secretPlaceholder(field, channel) : field.placeholder
      }
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ChannelCard({
  channel,
  onSaved,
}: {
  channel: ChannelView;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(() => initialValues(channel));
  const [enabled, setEnabled] = useState(channel.enabled);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues(channel));
    setEnabled(channel.enabled);
  }, [channel]);

  const Icon = CHANNEL_ICONS[channel.type];

  async function save() {
    setSaving(true);
    setNotice(null);
    setFailure(null);
    try {
      const config: Record<string, string | boolean> = {};
      for (const field of channel.fields) {
        const raw = values[field.key];
        if (field.kind === "switch") {
          config[field.key] = raw === true;
          continue;
        }
        const text = typeof raw === "string" ? raw.trim() : "";
        if (field.secret && text === "") continue;
        config[field.key] = text;
      }

      await adminRequest(`/api/admin/notifications/channels/${channel.type}`, {
        method: "PUT",
        body: JSON.stringify({ enabled, config }),
      });
      setNotice("已保存");
      onSaved();
    } catch (reason) {
      setFailure(describeAdminError(reason));
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setNotice(null);
    setFailure(null);
    try {
      const outcome = await adminRequest<DeliveryOutcome>(
        `/api/admin/notifications/channels/${channel.type}/test`,
        { method: "POST" },
      );
      if (outcome.ok) {
        setNotice(`测试消息已发送（${outcome.duration_ms} ms）`);
      } else {
        setFailure(outcome.error ?? "测试消息发送失败");
      }
      onSaved();
    } catch (reason) {
      setFailure(describeAdminError(reason));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-sky-300">
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <CardTitle className="flex items-center gap-2">
              {channel.label}
              {channel.enabled ? (
                <Badge variant={channel.configured ? "success" : "warning"}>
                  {channel.configured ? "已启用" : "待补全"}
                </Badge>
              ) : (
                <Badge variant="muted">已停用</Badge>
              )}
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              {formatDateTime(channel.updated_at) === "—"
                ? "尚未配置"
                : `更新于 ${formatDateTime(channel.updated_at)}`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEnabled((current) => !current)}
        >
          {enabled ? "停用" : "启用"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-xs text-slate-500">{channel.description}</p>

        <div className="space-y-3">
          {channel.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label>
                {field.label}
                {field.required ? (
                  <span className="ml-0.5 text-rose-400">*</span>
                ) : null}
              </Label>
              <FieldInput
                field={field}
                channel={channel}
                value={values[field.key] ?? ""}
                onChange={(next) =>
                  setValues((current) => ({ ...current, [field.key]: next }))
                }
              />
              {field.help ? (
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {field.help}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {failure ? <p className="text-xs text-rose-300">{failure}</p> : null}
        {notice ? <p className="text-xs text-emerald-300">{notice}</p> : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            保存
          </Button>
          <Button variant="outline" onClick={test} disabled={testing}>
            {testing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <SendHorizonal className="size-4" aria-hidden />
            )}
            发送测试
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RuleCard({
  rule,
  channels,
  onSaved,
}: {
  rule: RuleView;
  channels: ChannelView[];
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [selected, setSelected] = useState<ChannelType[]>(rule.channels);
  const [cooldown, setCooldown] = useState(String(rule.cooldown_seconds));
  const [settings, setSettings] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const threshold of rule.thresholds) {
      const stored = rule.settings[threshold.key];
      next[threshold.key] =
        typeof stored === "number" ? String(stored) : String(threshold.default);
    }
    return next;
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(rule.enabled);
    setSelected(rule.channels);
    setCooldown(String(rule.cooldown_seconds));
    const next: Record<string, string> = {};
    for (const threshold of rule.thresholds) {
      const stored = rule.settings[threshold.key];
      next[threshold.key] =
        typeof stored === "number" ? String(stored) : String(threshold.default);
    }
    setSettings(next);
  }, [rule]);

  function toggleChannel(type: ChannelType) {
    setSelected((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  const unavailable = selected.filter((type) => {
    const channel = channels.find((item) => item.type === type);
    return !channel?.enabled || !channel.configured;
  });

  async function save() {
    setSaving(true);
    setNotice(null);
    setFailure(null);
    try {
      const parsed: Record<string, number> = {};
      for (const threshold of rule.thresholds) {
        const raw = settings[threshold.key];
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          throw new Error(`${threshold.label} 需要填写数字`);
        }
        parsed[threshold.key] = value;
      }
      await adminRequest(`/api/admin/notifications/rules/${rule.event_key}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          channels: selected,
          cooldownSeconds: Number(cooldown),
          settings: parsed,
        }),
      });
      setNotice("已保存");
      onSaved();
    } catch (reason) {
      setFailure(describeAdminError(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {rule.label}
            <Badge variant={LEVEL_VARIANTS[rule.level] ?? "muted"}>
              {LEVEL_LABELS[rule.level] ?? rule.level}
            </Badge>
            {enabled ? null : <Badge variant="muted">未启用</Badge>}
          </CardTitle>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {rule.description}
          </p>
        </div>
        <span className="font-mono text-[11px] text-slate-600">
          {rule.event_key}
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((current) => !current)}
            className={`relative h-5 w-9 rounded-full transition ${
              enabled ? "bg-sky-400" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
                enabled ? "left-4.5" : "left-0.5"
              }`}
            />
          </button>
          <span className="text-xs text-slate-400">启用此预警</span>
        </div>

        <div className="space-y-1.5">
          <Label>推送渠道</Label>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_TYPES.map((type) => {
              const channel = channels.find((item) => item.type === type);
              const active = selected.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleChannel(type)}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    active
                      ? "border-sky-400/50 bg-sky-400/15 text-sky-200"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
                  }`}
                >
                  {channel?.label ?? type}
                </button>
              );
            })}
          </div>
          {unavailable.length > 0 ? (
            <p className="text-[11px] text-amber-300/80">
              以下渠道尚未启用或配置不完整，推送会被跳过：
              {unavailable.join("、")}
            </p>
          ) : null}
        </div>

        {rule.thresholds.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {rule.thresholds.map((threshold) => (
              <div key={threshold.key} className="space-y-1.5">
                <Label>{threshold.label}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={threshold.min}
                  max={threshold.max}
                  step={threshold.step}
                  value={settings[threshold.key] ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      [threshold.key]: event.target.value,
                    }))
                  }
                />
                {threshold.help ? (
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    {threshold.help}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-600">此预警没有可调阈值。</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>冷却时间（秒）</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={cooldown}
              onChange={(event) => setCooldown(event.target.value)}
            />
            <p className="text-[11px] text-slate-600">
              同一预警在冷却时间内不会重复推送。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>最近触发</Label>
            <p className="py-2 text-xs text-slate-400">
              {rule.last_fired_at ? formatDateTime(rule.last_fired_at) : "从未触发"}
            </p>
          </div>
        </div>

        {failure ? <p className="text-xs text-rose-300">{failure}</p> : null}
        {notice ? <p className="text-xs text-emerald-300">{notice}</p> : null}

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DispatchCard({
  channels,
  onDispatched,
}: {
  channels: ChannelView[];
  onDispatched: () => void;
}) {
  const [level, setLevel] = useState<NotificationLevel>("info");
  const [title, setTitle] = useState("手动测试推送");
  const [body, setBody] = useState(
    "如果你看到这条消息，说明预警通知链路已经打通。",
  );
  const [selected, setSelected] = useState<ChannelType[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    setSelected(
      channels.filter((item) => item.enabled).map((item) => item.type),
    );
  }, [channels]);

  async function submit() {
    setSending(true);
    setResult(null);
    setFailure(null);
    try {
      const payload = await adminRequest<{
        sent: boolean;
        reason: string | null;
        outcomes: DeliveryOutcome[];
        failed: number;
      }>("/api/admin/notifications/dispatch", {
        method: "POST",
        body: JSON.stringify({ level, title, body, channels: selected }),
      });
      const ok = payload.outcomes.filter((item) => item.ok).length;
      if (payload.failed > 0) {
        setFailure(
          `${payload.failed} 个渠道发送失败：` +
            payload.outcomes
              .filter((item) => !item.ok)
              .map((item) => `${item.channel}（${item.error ?? "未知错误"}）`)
              .join("，"),
        );
      }
      if (payload.sent) {
        setResult(`已推送到 ${ok} 个渠道`);
      } else if (payload.reason) {
        setResult(`未发送：${payload.reason}`);
      }
      onDispatched();
    } catch (reason) {
      setFailure(describeAdminError(reason));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>手动推送</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            立即向选定渠道发送一条通知，可用于验证配置。
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="dispatch-level">级别</Label>
            <Select
              id="dispatch-level"
              value={level}
              onChange={(event) =>
                setLevel(event.target.value as NotificationLevel)
              }
            >
              {NOTIFICATION_LEVELS.map((item) => (
                <option key={item} value={item}>
                  {LEVEL_LABELS[item] ?? item}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dispatch-title">标题</Label>
            <Input
              id="dispatch-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dispatch-body">内容</Label>
          <Textarea
            id="dispatch-body"
            value={body}
            rows={3}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>渠道</Label>
          <div className="flex flex-wrap gap-2">
            {channels.map((channel) => {
              const active = selected.includes(channel.type);
              return (
                <button
                  key={channel.type}
                  type="button"
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(channel.type)
                        ? current.filter((item) => item !== channel.type)
                        : [...current, channel.type],
                    )
                  }
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    active
                      ? "border-sky-400/50 bg-sky-400/15 text-sky-200"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
                  }`}
                >
                  {channel.label}
                  {channel.enabled ? "" : "（已停用）"}
                </button>
              );
            })}
          </div>
        </div>

        {failure ? <p className="text-xs text-rose-300">{failure}</p> : null}
        {result ? <p className="text-xs text-emerald-300">{result}</p> : null}

        <Button onClick={submit} disabled={sending || selected.length === 0}>
          {sending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          立即推送
        </Button>
      </CardContent>
    </Card>
  );
}

function LogsCard({ logs, total }: { logs: LogView[]; total: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>最近推送记录</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            共 {total} 条，仅保留最近 2000 条。
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {logs.length === 0 ? (
          <p className="px-5 pb-8 text-xs text-slate-600">还没有推送记录。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>级别</TableHead>
                  <TableHead>事件</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEVEL_VARIANTS[log.level] ?? "muted"}>
                        {levelText(log.level)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {log.title}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {log.channel_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[log.status] ?? "muted"}>
                        {STATUS_LABELS[log.status] ?? log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] text-xs text-slate-500">
                      <span className="line-clamp-2">
                        {log.error ?? `${log.duration_ms ?? 0} ms`}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SchedulerCard({ status }: { status: SchedulerStatus }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            巡检调度
            {status.active ? (
              <Badge variant="success">运行中</Badge>
            ) : (
              <Badge variant="muted">未运行</Badge>
            )}
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            后台每 {status.interval_minutes} 分钟自动检查一次，由
            NOTIFICATION_INTERVAL_MINUTES 控制。
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-xs text-slate-400 sm:grid-cols-3">
        <div>
          <p className="text-[11px] text-slate-600">本轮启动后运行次数</p>
          <p className="mt-1 text-slate-200">{status.run_count}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600">最近一次巡检</p>
          <p className="mt-1 text-slate-200">
            {status.last_run_at ? formatDateTime(status.last_run_at) : "尚未运行"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600">最近触发的预警</p>
          <p className="mt-1 text-slate-200">
            {status.last_triggered.length > 0
              ? status.last_triggered.join("、")
              : "无"}
          </p>
        </div>
        {status.last_error ? (
          <div className="sm:col-span-3">
            <p className="text-[11px] text-slate-600">最近一次错误</p>
            <p className="mt-1 break-words text-rose-300">{status.last_error}</p>
          </div>
        ) : null}
        {!status.active ? (
          <div className="sm:col-span-3">
            <p className="text-[11px] text-amber-300/80">
              调度器未启动，可在环境变量里设置 NOTIFICATION_CHECKS=1 并重启应用。
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function NotificationsManager() {
  const { data, loading, error, reload } =
    useAdminData<NotificationsResponse>("/api/admin/notifications");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AdminPageHeader
        eyebrow="Notifications"
        title="预警通知"
        description="配置 Telegram、邮件与 Webhook 渠道，选择要推送的预警事件与阈值，并查看最近的推送记录。"
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw
              className={`size-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden
            />
            刷新
          </Button>
        }
      />

      {error ? <AdminError message={error} /> : null}

      {loading && !data ? (
        <p className="text-xs text-slate-500">加载中…</p>
      ) : null}

      {data ? (
        <>
          <SchedulerCard status={data.scheduler} />

          <section className="space-y-3">
            <h2 className="text-xs font-medium tracking-[0.12em] text-slate-600 uppercase">
              推送渠道
            </h2>
            <div className="grid gap-4">
              {data.channels.map((channel) => (
                <ChannelCard
                  key={channel.type}
                  channel={channel}
                  onSaved={reload}
                />
              ))}
            </div>
          </section>

          <DispatchCard channels={data.channels} onDispatched={reload} />

          <section className="space-y-3">
            <h2 className="text-xs font-medium tracking-[0.12em] text-slate-600 uppercase">
              预警事件
            </h2>
            <div className="grid gap-4">
              {data.rules.map((rule) => (
                <RuleCard
                  key={rule.event_key}
                  rule={rule}
                  channels={data.channels}
                  onSaved={reload}
                />
              ))}
            </div>
          </section>

          <LogsCard logs={data.logs} total={data.log_total} />
        </>
      ) : null}
    </div>
  );
}