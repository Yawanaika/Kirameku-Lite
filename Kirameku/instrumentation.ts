import { env } from "./server/env";

/**
 * Next.js calls this once per server start. It boots the in-process alert
 * scheduler so backup/disk/error-rate checks run without an external cron.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!env.NOTIFICATION_CHECKS) return;

  const { startNotificationScheduler } = await import(
    "./server/modules/notifications/scheduler"
  );
  startNotificationScheduler();
}
