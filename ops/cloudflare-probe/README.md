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

# 4. D1 绑定：Telegram 兜底的抑制窗口存在这里（生产已就绪，换账号时重建）
npx wrangler d1 create kirameku-lite   # 把输出的 database_id 填进 wrangler.toml 的 [[d1_databases]]
npx wrangler d1 execute kirameku-lite --remote --command \
  "CREATE TABLE IF NOT EXISTS probe_alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, created_at INTEGER NOT NULL, detail TEXT)"

npx wrangler deploy
```

部署输出里会给出 `https://kirameku-lite.<account>.workers.dev`。cron 表达式在 `wrangler.toml` 的
`[triggers] crons`，默认 `*/5 * * * *`。

## 存储（D1）

抑制窗口（「30 分钟内不重复推 Telegram」）需要一份跨 cron 的状态，存在 D1 里：

| 项 | 值 |
|:---|:---|
| 数据库 | `kirameku-lite`，id `f8e6f9aa-bf0d-4a0c-8da8-6b7f03c11440`，绑定名 `PROBE_DB` |
| 表 / 索引 | `probe_alerts(id, kind, created_at, detail)` / `probe_alerts_kind_created_at(kind, created_at DESC)` |
| 何时写 | 只在「Telegram 直连兜底真的发出去了」时写一行；探测正常或走通知端点成功都不写库 |
| 何时读 | 只在要发 Telegram 之前读同 kind 的最新一行 |
| 抑制判据 | 最新一行距今 < `TELEGRAM_SUPPRESS_SECONDS`（30 分钟）就跳过 |
| 保留 | 每次写入顺带 `DELETE` 掉 30 天前的行（`ALERT_RETENTION_DAYS`） |

建表不用手工做：第一次写库时会先跑 `CREATE TABLE IF NOT EXISTS`（和删除、插入在同一个 `batch` 里），
所以漏跑迁移只会让抑制窗口失效到「第一次告警」为止，不会丢告警。D1 读写异常一律降级为「不抑制」，
绝不让兜底告警被状态存储拖死。

按每 5 分钟一次 cron 算：读 ≤ 288 行/天、写只在真告警时发生，免费额度（D1：500 万行读/天、10 万行写/天）
里可以忽略不计。

```bash
# 看抑制状态：空结果 = 还没发生过 Telegram 兜底投递（有行 = 抑制窗口在生效）
npx wrangler d1 execute kirameku-lite --remote --command \
  "SELECT kind, datetime(created_at/1000, 'unixepoch') AS at, detail FROM probe_alerts ORDER BY created_at DESC LIMIT 5"
```

## 当前生产状态（2026-10-24）

| 项 | 值 |
|:---|:---|
| Worker 名 / 地址 | `kirameku-lite` → `https://kirameku-lite.yawanaika.workers.dev`（account `af16f1d17243e21edf13cfbd34652d3c`，workers.dev 子域 `yawanaika`） |
| Cron | `*/5 * * * *`（注册于 2026-10-24T06:38Z） |
| 存储 | D1 `kirameku-lite`，id `f8e6f9aa-bf0d-4a0c-8da8-6b7f03c11440`，绑定名 `PROBE_DB`，表 `probe_alerts` |
| 绑定清单 | `CRON_SECRET` / `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`（`secret_text`），`NOTIFY_URL` / `TARGET_URL`（`plain_text`），`PROBE_DB`（`d1`） |
| 线上版本 | 2026-10-24T07:45Z 经 API 上传：本目录 `src/index.ts` 的 `tsc` 编译产物（8932 B，sha256 前 16 位 `71e4d923e836c872`，与本地一致） |

版本沿革：2026-10-24T06:42Z 跑的是仪表盘 Quick Edit 的 v1 bundle（抑制窗口用 KV `PROBE_STATE`），
同日改为 D1 后重新部署并成为当前版本，`recentlyAlerted` / `rememberAlert` 的容错也一并在线上生效。
v1 的 KV 命名空间 `kirameku-lite`（id `71924058c2bd492ba40e7e75264b98e7`）已不再被任何脚本或绑定引用，
确认无用后可以删掉：

```bash
npx wrangler kv namespace delete --namespace-id 71924058c2bd492ba40e7e75264b98e7
```

已验证：从服务器带 `CRON_SECRET` 手动触发一次 → `{"ok":true,"status":200,"notified":"none"}`；
D1 侧用同一套 SQL（建表、插入、按 kind 查最新一行、删除）走过一遍，表结构正确；此时 `probe_alerts` 为空，
说明还没发生过 Telegram 兜底投递（有行就代表抑制窗口在生效）。

时间点注意：**本机（中国大陆网络）连不上 `*.workers.dev`**（`curl` 超时，而同一台机器访问站点正常），
手动触发只能在服务器或开了代理的机器上做；cron 跑在 Cloudflare 边缘，不受影响。

```bash
# 在服务器上手动触发一次
cd /home/ubuntu/services/Kirameku-Lite
S=$(grep -m1 '^CRON_SECRET=' .env | cut -d= -f2-)
curl -s -G --data-urlencode "token=$S" https://kirameku-lite.yawanaika.workers.dev/ | jq
```

### 用 API 改绑定时的坑（2026-10-24 实测）

`PUT /accounts/{account_id}/workers/scripts/{script_name}?bindings_inherit=strict`（以及 `POST …/versions`）
的 `metadata.bindings` 是**整体替换**。想在不重传密钥的前提下换一个绑定，必须把已有的 `secret_text` 按名字原样传回：

```json
{ "bindings": [
  { "name": "CRON_SECRET", "type": "inherit" },
  { "name": "TELEGRAM_BOT_TOKEN", "type": "inherit" },
  { "name": "TELEGRAM_CHAT_ID", "type": "inherit" },
  { "name": "NOTIFY_URL", "type": "plain_text", "text": "…" },
  { "name": "TARGET_URL", "type": "plain_text", "text": "…" },
  { "name": "PROBE_DB", "type": "d1", "id": "f8e6f9aa-bf0d-4a0c-8da8-6b7f03c11440" }
] }
```

`inherit` 从**最近一次上传的版本**取值；带 `bindings_inherit=strict` 时解析不到就直接报 10057（不会静默丢绑定），
不带 strict 时会**静默丢弃**解析不到的项。另外 `PATCH …/script-settings` 只接受 `logpush` / `observability` /
`tags` / `tail_consumers`，改不了 binding。用 `wrangler deploy` 时这些都由它自动处理。

同一个 PUT 请求必须把**脚本内容**一起带上（`multipart/form-data`）：一个 `metadata` 部分（上面的 JSON，
`main_module` 指到模块文件名）加一个同名文件部分（`Content-Type: application/javascript+module`）。
内容与绑定在同一次上传里生效，所以换存储只会有一次窗口。校验办法是读回 `GET …/content/v2`、
剥掉 multipart 外壳后算 sha256，和本地编译产物逐字节比对（本次即 `71e4d923e836c872…`）。

## 验证

```bash
# 手动触发一次真实探测（不带 token 一律 404，这是故意的：探针端点不能公开）
curl -s "https://kirameku-lite.<account>.workers.dev/?token=$CRON_SECRET" | jq
# {"ok":true,"status":200,"notified":"none"}

# 看 cron 是否在跑、有没有异常
npx wrangler tail

# 兜底告警历史（空 = 从未走过 Telegram 直连）
npx wrangler d1 execute kirameku-lite --remote --command "SELECT * FROM probe_alerts ORDER BY created_at DESC LIMIT 5"

# 服务器侧确认投递结果（成功/冷却都会留下输出）
tail -n 20 /home/ubuntu/services/Kirameku-Lite/logs/probe.log   # 同机探针
# 后台记录：https://blog.yawanaika.com/admin/notifications -> 推送记录
```

故意制造一次失败来确认链路（记得改回来）：把 `wrangler.toml` 的 `TARGET_URL` 改成一个不存在的路径
（例如 `.../api/health-typo`），`npx wrangler deploy`，等一次 cron，确认后台「推送记录」里出现
`site.health / critical`；再把 Telegram secret 删掉、同时停掉站点，可以验证直连兜底那条分支
（跑通后 `probe_alerts` 里会出现第一行）。

## 调参与成本

| 项 | 位置 | 默认 |
|:---|:---|:---|
| 探测频率 | `wrangler.toml` → `[triggers] crons` | 每 5 分钟（最小 1 分钟） |
| 探测超时 | `src/index.ts` → `PROBE_TIMEOUT_MS` | 10s |
| 失败后立即重试间隔 | `src/index.ts` → `RETRY_DELAY_MS` | 2s |
| Telegram 兜底抑制窗口 | `src/index.ts` → `TELEGRAM_SUPPRESS_SECONDS` | 30 分钟（需要 D1 绑定） |
| 告警行保留 | `src/index.ts` → `ALERT_RETENTION_DAYS` | 30 天 |
| 站点侧冷却 | `catalog.ts` 的 `site.health` 规则 | 900s |

每 5 分钟一次 ≈ 288 请求/天，免费额度（10 万请求/天）里可以忽略不计。

## 排错

| 现象 | 原因 |
|:---|:---|
| 手动触发返回 404 | 没带 `?token=`，或 `CRON_SECRET` 没 `wrangler secret put` |
| 后台推送记录里没有新条目 | 站点收到了调用但规则关闭 / 没有启用渠道 / 命中 900s 冷却；`wrangler tail` 里能看到 `sent:false` 与 `reason` |
| 站点挂了但没收到 Telegram | 没配 `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`，或还在抑制窗口内（`wrangler tail` 会写明） |
| 每天都收到重复 Telegram | `PROBE_DB` 没绑或绑错库：抑制窗口无处可存，每次 cron 都会重新发（`wrangler tail` 里能看到 `could not record the suppression window`） |
| D1 查询报 no such table | 还没发生过告警（懒建表）；想先建好就按「存储（D1）」里的 SQL 手工执行一次 |
| cron 不触发 | `wrangler deploy` 之后才注册触发器；改完 `crons` 必须重新部署 |
| 探测总是失败但手工 curl 正常 | `TARGET_URL` 写错，或探测路径被 Cloudflare 的 WAF/缓存拦了（`/api/health` 本身是 `no-store`） |

## 安全

- Worker 只做「探测 + 转发」，不持有任何管理员凭据；`CRON_SECRET` 只用于调用内部端点。
- `TELEGRAM_BOT_TOKEN` 等一律用 `wrangler secret`，不要写进 `[vars]`（`vars` 会出现在部署产物与仪表盘里）。
- 手动触发需要 `CRON_SECRET`，否则返回 404：否则任何人都能用它放大流量或按需叫醒运维。
- D1 里只有告警时间戳与截断后的响应片段（≤300 字符），没有任何凭据。
