import type { NotificationLevel, NotificationMessage } from "./contracts";

const LEVEL_EMOJI: Record<NotificationLevel, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

const LEVEL_LABEL: Record<NotificationLevel, string> = {
  info: "提示",
  warning: "警告",
  critical: "严重",
};

const LEVEL_COLOR: Record<NotificationLevel, string> = {
  info: "#38bdf8",
  warning: "#f59e0b",
  critical: "#f43f5e",
};

export function levelLabel(level: NotificationLevel): string {
  return LEVEL_LABEL[level];
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  // Render in the server's local time so the reader sees wall-clock time.
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function formatTelegramText(message: NotificationMessage): string {
  const lines = [
    `${LEVEL_EMOJI[message.level]} ${message.title}`,
    `[${LEVEL_LABEL[message.level]}] ${formatTime(message.timestamp)}`,
  ];

  if (message.body) {
    lines.push("", message.body);
  }
  for (const field of message.fields) {
    lines.push(`${field.label}: ${field.value}`);
  }
  if (message.link) {
    lines.push("", message.link);
  }
  // Bot API rejects messages longer than 4096 chars.
  const text = lines.join("\n");
  return text.length > 4000 ? `${text.slice(0, 3980)}\n…（已截断）` : text;
}

export function formatEmail(message: NotificationMessage): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `[Kirameku][${LEVEL_LABEL[message.level]}] ${message.title}`;

  const textLines = [
    message.title,
    `级别：${LEVEL_LABEL[message.level]}`,
    `时间：${formatTime(message.timestamp)}`,
    "",
    message.body,
  ];
  for (const field of message.fields) {
    textLines.push(`${field.label}：${field.value}`);
  }
  if (message.link) {
    textLines.push("", message.link);
  }

  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const fieldRows = message.fields
    .map(
      (field) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${escape(
          field.label,
        )}</td><td style="padding:4px 0;color:#0f172a">${escape(
          field.value,
        )}</td></tr>`,
    )
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6">
  <div style="border-left:3px solid ${LEVEL_COLOR[message.level]};padding-left:12px">
    <h2 style="margin:0 0 4px;font-size:17px;color:#0f172a">${escape(message.title)}</h2>
    <p style="margin:0;font-size:12px;color:#64748b">${LEVEL_LABEL[message.level]} · ${formatTime(
      message.timestamp,
    )}</p>
  </div>
  ${message.body ? `<p style="margin:16px 0;color:#334155;white-space:pre-wrap">${escape(message.body)}</p>` : ""}
  ${fieldRows ? `<table style="font-size:13px;border-collapse:collapse">${fieldRows}</table>` : ""}
  ${message.link ? `<p style="margin:16px 0 0"><a href="${escape(message.link)}">${escape(message.link)}</a></p>` : ""}
  <p style="margin:20px 0 0;font-size:11px;color:#94a3b8">来自 Kirameku 预警通知（${escape(
    message.eventKey,
  )}）</p>
</div>`;

  return { subject, text: textLines.join("\n"), html };
}

export function formatWebhookPayload(message: NotificationMessage) {
  return {
    source: "kirameku",
    event: message.eventKey,
    level: message.level,
    title: message.title,
    body: message.body,
    fields: Object.fromEntries(
      message.fields.map((field) => [field.label, field.value]),
    ),
    link: message.link ?? null,
    timestamp: message.timestamp,
  };
}
