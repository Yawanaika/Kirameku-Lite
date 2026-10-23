import "server-only";
import { env } from "@/server/env";
import { runNotificationChecks, type CheckReport } from "./checks";
import { getNotificationsService } from "./index";

/**
 * Interval-based alert evaluation. The app is one Node process, so a plain
 * timer is enough — no external scheduler and no extra runtime.
 */
let timer: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;
let ticking = false;

let lastRunAt: string | null = null;
let lastReport: CheckReport | null = null;
let lastError: string | null = null;
let runCount = 0;

export interface SchedulerStatus {
  active: boolean;
  interval_minutes: number;
  run_count: number;
  last_run_at: string | null;
  last_error: string | null;
  last_triggered: string[];
}

export function getSchedulerStatus(): SchedulerStatus {
  return {
    active: timer !== null,
    interval_minutes: env.NOTIFICATION_INTERVAL_MINUTES,
    run_count: runCount,
    last_run_at: lastRunAt,
    last_error: lastError,
    last_triggered: lastReport?.triggered ?? [],
  };
}

/** Run one evaluation round; concurrent calls are collapsed. */
export async function runChecksNow(): Promise<CheckReport> {
  if (ticking) {
    return (
      lastReport ?? {
        ran_at: new Date().toISOString(),
        outcomes: [],
        triggered: [],
        errors: ["已有一轮检查在执行"],
      }
    );
  }

  ticking = true;
  try {
    const report = await runNotificationChecks(getNotificationsService());
    lastReport = report;
    lastRunAt = report.ran_at;
    runCount += 1;
    lastError = report.errors.length > 0 ? report.errors.join("; ") : null;
    return report;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    lastRunAt = new Date().toISOString();
    throw error;
  } finally {
    ticking = false;
  }
}

function schedule(intervalMinutes: number): void {
  if (timer || initialTimer) return;

  const intervalMs = Math.max(1, intervalMinutes) * 60_000;
  // Wait a little after boot so the first check does not compete with startup.
  initialTimer = setTimeout(() => {
    initialTimer = null;
    void runChecksNow().catch(() => undefined);
  }, 20_000);
  initialTimer.unref?.();

  timer = setInterval(() => {
    void runChecksNow().catch(() => undefined);
  }, intervalMs);
  timer.unref?.();
}

export function startNotificationScheduler(
  options: { intervalMinutes?: number } = {},
): SchedulerStatus {
  schedule(options.intervalMinutes ?? env.NOTIFICATION_INTERVAL_MINUTES);
  return getSchedulerStatus();
}

export function stopNotificationScheduler(): void {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
