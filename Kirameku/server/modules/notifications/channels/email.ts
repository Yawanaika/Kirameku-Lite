import nodemailer from "nodemailer";
import type { ChannelConfig, NotificationMessage } from "../contracts";
import { formatEmail } from "../format";
import {
  DeliveryError,
  booleanValue,
  numberValue,
  stringValue,
} from "../transport";

function recipients(config: ChannelConfig): string[] {
  return stringValue(config, "to")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** Send one alert through SMTP (nodemailer). */
export async function sendEmail(
  config: ChannelConfig,
  message: NotificationMessage,
): Promise<void> {
  const host = stringValue(config, "host");
  const from = stringValue(config, "from");
  const to = recipients(config);
  if (!host || !from || to.length === 0) {
    throw new DeliveryError("邮件通道未配置 SMTP 主机、发件人或收件人");
  }

  const port = numberValue(config, "port") ?? 465;
  const secure = booleanValue(config, "secure");
  const user = stringValue(config, "user");
  const pass = stringValue(config, "pass");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  const { subject, text, html } = formatEmail(message);

  try {
    await transporter.sendMail({ from, to: to.join(", "), subject, text, html });
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    const reason = error instanceof Error ? error.message : String(error);
    // SMTP 4xx is transient, authentication/recipient errors are not.
    const retryable =
      code === "ETIMEDOUT" ||
      code === "ECONNECTION" ||
      code === "ESOCKET" ||
      code === "EDNS" ||
      code.startsWith("4");
    throw new DeliveryError(
      `邮件发送失败${code ? `（${code}）` : ""}：${reason}`,
      { retryable },
    );
  } finally {
    transporter.close();
  }
}
