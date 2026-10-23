import { afterEach, describe, expect, it, vi } from "vitest";
import {
  startNotificationScheduler,
  stopNotificationScheduler,
} from "./scheduler";

afterEach(() => {
  stopNotificationScheduler();
  vi.useRealTimers();
});

describe("notification scheduler", () => {
  it("shares scheduled state across separately loaded module instances", async () => {
    vi.useFakeTimers();
    const started = startNotificationScheduler({ intervalMinutes: 5 });
    expect(started.active).toBe(true);
    const timerCount = vi.getTimerCount();

    vi.resetModules();
    const secondModule = await import("./scheduler");

    expect(secondModule.getSchedulerStatus().active).toBe(true);
    expect(secondModule.ensureNotificationScheduler().active).toBe(true);
    secondModule.startNotificationScheduler({ intervalMinutes: 5 });
    expect(vi.getTimerCount()).toBe(timerCount);

    secondModule.stopNotificationScheduler();
    expect(secondModule.getSchedulerStatus().active).toBe(false);
  });
});
