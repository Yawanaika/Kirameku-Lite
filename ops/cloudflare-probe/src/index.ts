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

/**
 * The slice of the D1 API this file uses. Declared locally so the probe still
 * type-checks with a plain `tsc` (no @cloudflare/workers-types dependency).
 */
interface D1Result {
  success: boolean;
  meta?: unknown;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface Env {
  TARGET_URL: string;
  NOTIFY_URL: string;
  CRON_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  /** D1 database holding the fallback-alert log; see wrangler.toml. */
  PROBE_DB?: D1Database;
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
/** Every Telegram fallback lands as one row of this kind in `probe_alerts`. */
const TELEGRAM_ALERT_KIND = "telegram-fallback";
/** Rows older than this are pruned on every write; the table is a short log. */
const ALERT_RETENTION_DAYS = 30;
const SCHEMA_SQL = [
  "CREATE TABLE IF NOT EXISTS probe_alerts (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "kind TEXT NOT NULL, " +
    "created_at INTEGER NOT NULL, " +
    "detail TEXT)",
  "CREATE INDEX IF NOT EXISTS probe_alerts_kind_created_at ON probe_alerts (kind, created_at DESC)",
];

export default {
  async scheduled(_event: unknown, env: Env, ctx: Ctx): Promise<void> {
    ctx.waitUntil(run(env, "cron"));
  },

  /**
   * Manual trigger. This Worker is public, so it answers 404 to everyone who
   * does not hold CRON_SECRET: an open probe endpoint would be both a free
   * traffic amplifier and a way to page the operator on demand.
   *
   *   curl -s "https://kirameku-lite.<account>.workers.dev/?token=$CRON_SECRET" | jq
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
    await rememberAlert(env, result, trigger);
    return "telegram";
  } catch (error) {
    return `telegram failed: ${errorMessage(error)}`;
  }
}

/**
 * Suppression lives in D1 (`probe_alerts`); without the binding the fallback
 * repeats on every cron tick.
 */
async function recentlyAlerted(env: Env): Promise<boolean> {
  if (!env.PROBE_DB) return false;
  try {
    const row = await env.PROBE_DB.prepare(
      "SELECT created_at FROM probe_alerts WHERE kind = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(TELEGRAM_ALERT_KIND)
      .first<{ created_at: number }>();
    const at = Number(row?.created_at ?? 0);
    return Number.isFinite(at) && at > 0 && Date.now() - at < TELEGRAM_SUPPRESS_SECONDS * 1000;
  } catch {
    // A failed suppression read must never swallow the fallback alert: treat an
    // unreadable database as "not suppressed" and let the Telegram call go out.
    return false;
  }
}

async function rememberAlert(env: Env, result: ProbeResult, trigger: string): Promise<void> {
  if (!env.PROBE_DB) return;
  try {
    // The CREATE statements are issued here on purpose: an un-migrated database
    // only loses suppression until the first alert creates the table, and one
    // batch keeps schema + prune + insert in a single round trip.
    await env.PROBE_DB.batch([
      env.PROBE_DB.prepare(SCHEMA_SQL[0]),
      env.PROBE_DB.prepare(SCHEMA_SQL[1]),
      env.PROBE_DB.prepare("DELETE FROM probe_alerts WHERE created_at < ?").bind(
        Date.now() - ALERT_RETENTION_DAYS * 86_400_000,
      ),
      env.PROBE_DB.prepare("INSERT INTO probe_alerts (kind, created_at, detail) VALUES (?, ?, ?)").bind(
        TELEGRAM_ALERT_KIND,
        Date.now(),
        `${result.status ?? "n/a"} ${trigger}: ${result.detail}`.slice(0, 300),
      ),
    ]);
  } catch (error) {
    // The message already went out; a failed suppression write only costs us a
    // duplicate next tick, so it must not be reported as a delivery failure.
    console.warn(`probe: could not record the suppression window: ${errorMessage(error)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
