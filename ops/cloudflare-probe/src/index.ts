/**
 * Off-host health probe (方案 A).
 *
 * Every alert the application sends — including the ones raised through
 * POST /api/internal/notify — travels through the site itself, so nothing on
 * the host can report "the site is unreachable". This Worker runs outside the
 * machine on a Cron Trigger, dials the public /api/health, and reports through
 * /api/internal/notify. When even that delivery fails (the site is fully down),
 * it falls back to a direct Telegram call so the alert still lands.
 *
 * Deploy: see ops/cloudflare-probe/README.md
 */

interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  TARGET_URL: string;
  NOTIFY_URL: string;
  CRON_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  PROBE_STATE?: KVStore;
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

interface ProbeResult {
  ok: boolean;
  status: number | null;
  detail: string;
}

const PROBE_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 2_000;
const TELEGRAM_SUPPRESS_SECONDS = 30 * 60;
const STATE_KEY = "last-telegram-alert";

export default {
  async scheduled(_event: unknown, env: Env, ctx: Ctx): Promise<void> {
    ctx.waitUntil(run(env, "cron"));
  },

  /**
   * Manual trigger. This Worker is public, so it answers 404 to everyone who
   * does not hold CRON_SECRET: an open probe endpoint would be both a free
   * traffic amplifier and a way to page the operator on demand.
   *
   *   curl -s "https://kirameku-probe.<account>.workers.dev/?token=$CRON_SECRET" | jq
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!env.CRON_SECRET || url.searchParams.get("token") !== env.CRON_SECRET) {
      return new Response("Not Found", { status: 404 });
    }
    const result = await run(env, "manual");
    return Response.json(result, { status: result.ok ? 200 : 503 });
  },
};

async function run(env: Env, trigger: string): Promise<{ ok: boolean; status: number | null; notified: string }> {
  let result = await probe(env.TARGET_URL);
  if (!result.ok) {
    // One immediate retry: a single dropped packet must not page anyone, and
    // unlike the host probe this worker has no state to remember a streak in.
    await sleep(RETRY_DELAY_MS);
    const retry = await probe(env.TARGET_URL);
    result = {
      ok: retry.ok,
      status: retry.status,
      detail: `${result.status ?? "n/a"} then ${retry.status ?? "n/a"}: ${retry.detail}`,
    };
  }
  if (result.ok) return { ok: true, status: result.status, notified: "none" };

  const viaSite = await notifySite(env, result, trigger);
  if (viaSite.ok) return { ok: false, status: result.status, notified: `notify-endpoint (${viaSite.detail})` };

  const viaTelegram = await notifyTelegram(env, result, trigger, viaSite.detail);
  return { ok: false, status: result.status, notified: viaTelegram };
}

async function probe(target: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // `cf` is a Workers-only extension of RequestInit, so keep it in a local
    // object and assert: the file then type-checks with a plain tsc too.
    const init = {
      signal: controller.signal,
      // An edge cache answering for the origin would make a broken site look
      // healthy. /api/health already sends no-store; this is belt and braces.
      cf: { cacheTtl: 0, cacheEverything: false },
      headers: { "user-agent": "kirameku-lite/1 (+ops/cloudflare-probe)", "cache-control": "no-cache" },
    };
    const response = await fetch(target, init as RequestInit);
    const text = (await response.text()).slice(0, 300);
    let healthy = response.status === 200;
    if (healthy) {
      try {
        healthy = (JSON.parse(text) as { ok?: boolean }).ok === true;
      } catch {
        healthy = false;
      }
    }
    return { ok: healthy, status: response.status, detail: text.replace(/\s+/g, " ") };
  } catch (error) {
    return { ok: false, status: null, detail: errorMessage(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function notifySite(env: Env, result: ProbeResult, trigger: string): Promise<{ ok: boolean; detail: string }> {
  if (!env.CRON_SECRET) return { ok: false, detail: "CRON_SECRET is not configured" };
  const payload = {
    eventKey: "site.health",
    level: "critical",
    title: "外部探针：站点不可达",
    body: `Cloudflare Worker 连续两次探测失败（触发：${trigger}）。响应：${result.detail}`.slice(0, 500),
    fields: [
      { label: "target", value: env.TARGET_URL },
      { label: "http", value: String(result.status ?? "n/a") },
      { label: "probe", value: "cloudflare-worker" },
    ],
    link: env.TARGET_URL,
  };
  try {
    const response = await fetch(env.NOTIFY_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = (await response.text()).slice(0, 200);
    // A 2xx means the endpoint took the call — including "sent: false, reason:
    // cooldown", which is the server doing its job, not a delivery failure.
    return { ok: response.ok, detail: `${response.status} ${text}` };
  } catch (error) {
    return { ok: false, detail: errorMessage(error) };
  }
}

async function notifyTelegram(env: Env, result: ProbeResult, trigger: string, siteDetail: string): Promise<string> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return `none — notify endpoint failed (${siteDetail}); set TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID to cover a total outage`;
  }
  if (await recentlyAlerted(env)) {
    return "telegram suppressed (within the suppression window)";
  }
  const text = [
    "🚨 Kirameku-Lite 外部探针：站点不可达",
    `目标：${env.TARGET_URL}`,
    `状态：${result.status ?? "n/a"}`,
    `触发：${trigger}`,
    `详情：${result.detail}`,
  ]
    .join("\n")
    .slice(0, 900);
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    });
    if (!response.ok) {
      return `telegram ${response.status} ${(await response.text()).slice(0, 160)}`;
    }
    await rememberAlert(env);
    return "telegram";
  } catch (error) {
    return `telegram failed: ${errorMessage(error)}`;
  }
}

/** Suppression needs KV; without the binding the fallback repeats every cron tick. */
async function recentlyAlerted(env: Env): Promise<boolean> {
  if (!env.PROBE_STATE) return false;
  const stored = await env.PROBE_STATE.get(STATE_KEY);
  const at = stored ? Number(stored) : 0;
  return Number.isFinite(at) && Date.now() - at < TELEGRAM_SUPPRESS_SECONDS * 1000;
}

async function rememberAlert(env: Env): Promise<void> {
  if (!env.PROBE_STATE) return;
  await env.PROBE_STATE.put(STATE_KEY, String(Date.now()), { expirationTtl: TELEGRAM_SUPPRESS_SECONDS * 2 });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
