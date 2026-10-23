import "server-only";
import { env } from "@/server/env";
import { runNotificationChecks, type CheckReport } from "./checks";
import { getNotificationsService } from "./index";

/**
 * Next.js may evaluate this module through separate server entry runtimes
 * (instrumentation and route handlers). Keep scheduler state on globalThis so
 * startup, status reads, and manual runs all observe the same process state.
 */
interface SchedulerState {
  timer: ReturnType<typeof setInterval> | null;
  initialTimer: ReturnType<typeof setTimeout> | null;
  ticking: boolean;
  lastRunAt: string | null;
  lastReport: CheckReport | null;
  lastError: string | null;
  runCount: number;
}

const schedulerStateKey = "__kiramekuNotificationScheduler" as const;
const schedulerGlobal = globalThis as typeof globalThis & {
  [schedulerStateKey]?: SchedulerState;
};
const state = (schedulerGlobal[schedulerStateKey] ??= {
  timer: null,
  initialTimer: null,
  ticking: false,
  lastRunAt: null,
  lastReport: null,
  lastError: null,
  runCount: 0,
});

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
    active: state.timer !== null,
    interval_minutes: env.NOTIFICATION_INTERVAL_MINUTES,
    run_count: state.runCount,
    last_run_at: state.lastRunAt,
    last_error: state.lastError,
    last_triggered: state.lastReport?.triggered ?? [],
  };
}

/** Run one evaluation round; concurrent calls are collapsed. */
export async function runChecksNow(): Promise<CheckReport> {
  if (state.ticking) {
    return (
      state.lastReport ?? {
        ran_at: new Date().toISOString(),
        outcomes: [],
        triggered: [],
        errors: ["已有一轮检查在执行"],
      }
    );
  }

  state.ticking = true;
  try {
    const report = await runNotificationChecks(getNotificationsService());
    state.lastReport = report;
    state.lastRunAt = report.ran_at;
    state.runCount += 1;
    state.lastError = report.errors.length > 0 ? report.errors.join("; ") : null;
    return report;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    state.lastRunAt = new Date().toISOString();
    throw error;
  } finally {
    state.ticking = false;
  }
}

function schedule(intervalMinutes: number): void {
  if (state.timer || state.initialTimer) return;

  const intervalMs = Math.max(1, intervalMinutes) * 60_000;
  // Wait a little after boot so the first check does not compete with startup.
  state.initialTimer = setTimeout(() => {
    state.initialTimer = null;
    void runChecksNow().catch(() => undefined);
  }, 20_000);
  state.initialTimer.unref?.();

  state.timer = setInterval(() => {
    void runChecksNow().catch(() => undefined);
  }, intervalMs);
  state.timer.unref?.();
}

export function startNotificationScheduler(
  options: { intervalMinutes?: number } = {},
): SchedulerStatus {
  schedule(options.intervalMinutes ?? env.NOTIFICATION_INTERVAL_MINUTES);
  return getSchedulerStatus();
}

/** Start lazily when an admin status request reaches a separate server bundle. */
export function ensureNotificationScheduler(): SchedulerStatus {
  return env.NOTIFICATION_CHECKS
    ? startNotificationScheduler()
    : getSchedulerStatus();
}

export function stopNotificationScheduler(): void {
  if (state.initialTimer) {
    clearTimeout(state.initialTimer);
    state.initialTimer = null;
  }
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}
