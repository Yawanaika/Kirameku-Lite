# 站外健康探针（方案 A：Cloudflare Worker + Cron Trigger）

站点自己的告警链路有一个结构性盲区：**所有通知都要经由站点投递**。`/api/internal/notify` 就在这台机器上，
进程内的 `site.health` 自检也只看得见 Node 进程自己。于是「整机宕机 / 容器没起来 / Tunnel 断了 / 反代 502」
这几种最需要有人知道的情况，恰恰没有任何一条告警能发出来。

这个 Worker 跑在 Cloudflare 边缘，每 5 分钟从站外请求一次公网 `/api/health`：

1. 探测失败 → 先立即重试一次（单次抖动不叫人）；
2. 仍然失败 → POST `/api/internal/notify`，走站点自己的通知规则与渠道（事件 `site.health`，服务端 900s 冷却）；
3. **连通知端点也投不出去**（站点整体不可达）→ 用 Telegram Bot API 直连兜底，至少让告警落地。

## 与同机探针（方案 B）的分工

| 故障 | 站外探针（本目录） | 同机 timer `scripts/probe-health.sh` | 进程内 `site.health` |
|:---|:---:|:---:|:---:|
| 应用进程异常 / 数据库不可用（站点仍能被访问） | ✅ | ✅ | ✅ |
| 反代 502、Tunnel 断开、容器 unhealthy | ✅ | ✅（走容器地址投递） | ❌ |
| 整机宕机 / 断电 / 网络中断 | ✅（Telegram 直连兜底） | ❌ | ❌ |

两个都配才完整：B 便宜、延迟低，是主力；A 是「机器都没了」时唯一还活着的那条路。

## 前置条件

- 一个 Cloudflare 账号（免费版够用），域名可以在 Cloudflare 上（本仓库的 `blog.yawanaika.com` 已经在）；
- 本地有 `wrangler`：`npx wrangler --version` 或 `npm i -g wrangler`（Node 22）；
- 服务器 `.env` 里已经配了 `CRON_SECRET`（`/api/internal/notify` 未配置时按 404 隐藏）。

## 部署

```bash
cd ops/cloudflare-probe
npx wrangler login

# 1. 改 wrangler.toml 里的 TARGET_URL / NOTIFY_URL（默认已经是本项目的线上域名）
# 2. 必需的 secret：与服务器 .env 里的 CRON_SECRET 保持一致
npx wrangler secret put CRON_SECRET

# 3.（可选，强烈建议）站点整体挂掉时的直连兜底
npx wrangler secret put TELEGRAM_BOT_TOKEN     # 与后台通知渠道用的同一个 bot
npx wrangler secret put TELEGRAM_CHAT_ID

# 4. KV 绑定：Telegram 兜底会自我抑制，默认 30 分钟一条（生产已就绪，换账号时重建）
npx wrangler kv namespace create kirameku-lite   # 把输出的 id 填进 wrangler.toml 的 [[kv_namespaces]]

npx wrangler deploy
```

部署输出里会给出 `https://kirameku-lite.<account>.workers.dev`。cron 表达式在 `wrangler.toml` 的
`[triggers] crons`，默认 `*/5 * * * *`。

## 当前生产状态（2026-10-24）

| 项 | 值 |
|:---|:---|
| Worker 名 / 地址 | `kirameku-lite` → `https://kirameku-lite.yawanaika.workers.dev`（account `af16f1d17243e21edf13cfbd34652d3c`，workers.dev 子域 `yawanaika`） |
| Cron | `*/5 * * * *`（注册于 2026-10-24T06:38Z） |
| KV 命名空间 | `kirameku-lite`，id `71924058c2bd492ba40e7e75264b98e7`，绑定名 `PROBE_STATE` |
| 绑定清单 | `CRON_SECRET` / `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`（`secret_text`），`NOTIFY_URL` / `TARGET_URL`（`plain_text`），`PROBE_STATE`（`kv_namespace`） |

注意：**线上正在跑的是 2026-10-24T06:42Z 那版 bundle**（仪表盘 Quick Edit），仓库 `src/index.ts` 之后补的两处 KV 容错
`recentlyAlerted` / `rememberAlert` 的 `try/catch` 要等下一次 `wrangler deploy` 才会生效（本轮只改了绑定、内容原样回传）。

已验证：从服务器带 `CRON_SECRET` 手动触发一次 → `{"ok":true,"status":200,"notified":"none"}`；KV 里此时没有 key，
说明还没发生过 Telegram 兜底投递（有 key 就代表抑制窗口在生效）。

时间点注意：**本机（中国大陆网络）连不上 `*.workers.dev`**（`curl` 超时，而同一台机器访问站点正常），
手动触发只能在服务器或开了代理的机器上做；cron 跑在 Cloudflare 边缘，不受影响。

```bash
# 在服务器上手动触发一次
cd /home/ubuntu/services/Kirameku-Lite
S=$(grep -m1 '^CRON_SECRET=' .env | cut -d= -f2-)
curl -s -G --data-urlencode "token=$S" https://kirameku-lite.yawanaika.workers.dev/ | jq

# 看抑制状态有没有写进 KV（有 key = 最近发生过 Telegram 兜底投递）
npx wrangler kv key list --namespace-id 71924058c2bd492ba40e7e75264b98e7
```

### 用 API 改绑定时的坑（2026-10-24 实测）

`PUT /accounts/{account_id}/workers/scripts/{script_name}?bindings_inherit=strict`（以及 `POST …/versions`）
的 `metadata.bindings` 是**整体替换**。想在不重传密钥的前提下加一个绑定，必须把已有的 `secret_text` 按名字原样传回：

```json
{ "bindings": [
  { "name": "CRON_SECRET", "type": "inherit" },
  { "name": "TELEGRAM_BOT_TOKEN", "type": "inherit" },
  { "name": "TELEGRAM_CHAT_ID", "type": "inherit" },
  { "name": "NOTIFY_URL", "type": "plain_text", "text": "…" },
  { "name": "TARGET_URL", "type": "plain_text", "text": "…" },
  { "name": "PROBE_STATE", "type": "kv_namespace", "namespace_id": "71924058c2bd492ba40e7e75264b98e7" }
] }
```

`inherit` 从**最近一次上传的版本**取值；带 `bindings_inherit=strict` 时解析不到就直接报 10057（不会静默丢绑定），
不带 strict 时会**静默丢弃**解析不到的项。另外 `PATCH …/script-settings` 只接受 `logpush` / `observability` /
`tags` / `tail_consumers`，改不了 binding。用 `wrangler deploy` 时这些都由它自动处理。

## 验证

```bash
# 手动触发一次真实探测（不带 token 一律 404，这是故意的：探针端点不能公开）
curl -s "https://kirameku-lite.<account>.workers.dev/?token=$CRON_SECRET" | jq
# {"ok":true,"status":200,"notified":"none"}

# 看 cron 是否在跑、有没有异常
npx wrangler tail

# 服务器侧确认投递结果（成功/冷却都会留下输出）
tail -n 20 /home/ubuntu/services/Kirameku-Lite/logs/maintenance.log   # 同机探针
# 后台记录：https://blog.yawanaika.com/admin/notifications -> 推送记录
```

故意制造一次失败来确认链路（记得改回来）：把 `wrangler.toml` 的 `TARGET_URL` 改成一个不存在的路径
（例如 `.../api/health-typo`），`npx wrangler deploy`，等一次 cron，确认后台「推送记录」里出现
`site.health / critical`；再把 Telegram secret 删掉、同时停掉站点，可以验证直连兜底那条分支。

## 调参与成本

| 项 | 位置 | 默认 |
|:---|:---|:---|
| 探测频率 | `wrangler.toml` → `[triggers] crons` | 每 5 分钟（最小 1 分钟） |
| 探测超时 | `src/index.ts` → `PROBE_TIMEOUT_MS` | 10s |
| 失败后立即重试间隔 | `src/index.ts` → `RETRY_DELAY_MS` | 2s |
| Telegram 兜底抑制窗口 | `src/index.ts` → `TELEGRAM_SUPPRESS_SECONDS` | 30 分钟（需要 KV） |
| 站点侧冷却 | `catalog.ts` 的 `site.health` 规则 | 900s |

每 5 分钟一次 ≈ 288 请求/天，免费额度（10 万请求/天）里可以忽略不计。

## 排错

| 现象 | 原因 |
|:---|:---|
| 手动触发返回 404 | 没带 `?token=`，或 `CRON_SECRET` 没 `wrangler secret put` |
| 后台推送记录里没有新条目 | 站点收到了调用但规则关闭 / 没有启用渠道 / 命中 900s 冷却；`wrangler tail` 里能看到 `sent:false` 与 `reason` |
| 站点挂了但没收到 Telegram | 没配 `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`，或还在抑制窗口内（`wrangler tail` 会写明） |
| cron 不触发 | `wrangler deploy` 之后才注册触发器；改完 `crons` 必须重新部署 |
| 探测总是失败但手工 curl 正常 | `TARGET_URL` 写错，或探测路径被 Cloudflare 的 WAF/缓存拦了（`/api/health` 本身是 `no-store`） |

## 安全

- Worker 只做「探测 + 转发」，不持有任何管理员凭据；`CRON_SECRET` 只用于调用内部端点。
- `TELEGRAM_BOT_TOKEN` 等一律用 `wrangler secret`，不要写进 `[vars]`（`vars` 会出现在部署产物与仪表盘里）。
- 手动触发需要 `CRON_SECRET`，否则返回 404：否则任何人都能用它放大流量或按需叫醒运维。
