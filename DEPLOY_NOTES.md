# Kirameku 部署与运维记录

> **2026-10-22 架构现状**
>
> 旧版 `Kirameku-backend/`（FastAPI + Vue 管理后台 + PostgreSQL）及 PostgreSQL → SQLite 一次性迁移脚本已经删除。当前生产只有一个 Node.js 进程和一个 SQLite 文件；入口 Caddy 跑在独立的 compose 项目里，通过共享 Docker 网络接入本项目。
>
> 镜像由 GitHub Actions 构建并推送到 GHCR，服务器上只做 `docker compose pull` + `up -d`，不编译任何代码。

## 1. 当前架构

```text
浏览器
  └── Caddy                       ← 你自己的 compose 项目
        │                           通过 kirameku-edge 网络反代 kirameku-app:3000
        └── Next.js 16 容器       ← 从 GHCR 拉取的镜像，本项目，不发布宿主机端口
              ├── 前台页面 / RSC / RSS / sitemap
              ├── /admin 后台页面
              ├── /api/* Route Handlers
              ├── /uploads/* 本地图片读取（未配置 OSS 时）
              └── SQLite（WAL，单文件，宿主机 ./data/db/kirameku.db）
```

发布链路：

```text
push to main
  └── GitHub Actions
        ├── verify：typecheck → test → db:migrate → build
        ├── image ：buildx 构建 linux/amd64 + linux/arm64 → 推送 ghcr.io/<owner>/kirameku
        └── deploy：SSH 到服务器 → scripts/deploy-server.sh
              ├── 确保共享网络 kirameku-edge 存在
              ├── 备份 SQLite（pnpm db:backup --prune）
              ├── docker compose pull
              ├── docker compose up -d
              └── 等 healthcheck；不健康则自动回滚到上一个镜像
```

约束：

- **只能跑一个写实例。** SQLite 是单写者，不能开多个 Node 实例同时写同一个数据库文件，也不能把数据库放在 NFS 上。
- **不要直接 `cp` 正在使用的数据库。** 使用 `pnpm db:backup` / `pnpm db:restore`；恢复前先停应用。
- **图片目录要持久化。** 未配置 OSS 时，上传文件写入 `UPLOAD_DIR`（容器内 `/data/uploads`）；容器重建不能把它清掉。
- **不要再加 `/api` 反代。** `next.config.mjs` 没有 rewrites，未命中的 `/api/*`、`/uploads/*` 会直接 404；缺少接口时应该补 Route Handler，而不是转发到旧服务。
- **服务器不构建镜像。** 生产机上不要跑 `docker build`，镜像一律来自 CI（本地开发需要时用 `docker-compose.build.yml`）。
- **本项目不发布宿主机端口。** 应用只在共享 Docker 网络上以 `kirameku-app:3000` 出现，由你自己的反代接入；见第 3 节。

## 2. 服务器一次性初始化

要求：Docker Engine 24+ 与 Compose v2（`docker compose version` 可用），80/443 端口已经由你的反代占用（不需要再给本项目开）。

```bash
sudo mkdir -p /srv/kirameku
sudo chown "$USER":"$USER" /srv/kirameku
cd /srv/kirameku

# compose 文件与部署脚本都来自仓库
git clone https://github.com/<owner>/Kirameku-Lite.git .
# 或只同步需要的文件：
#   docker-compose.yml、compose.env.example、scripts/deploy-server.sh
#   （只有让本项目自带 Caddy 时才需要 Caddyfile 与 docker-compose.caddy.yml）

cp compose.env.example .env
# 必填：
#   AUTH_SECRET=$(openssl rand -base64 48)
#   FRONTEND_ORIGIN=https://boke.hiromu.top
# 按需：SHARED_NETWORK / CRON_SECRET / GITHUB_* / OSS_*

docker compose pull
docker compose up -d

# 首次创建管理员（不提供默认密码）
docker compose exec app \
  env ADMIN_USERNAME=admin ADMIN_PASSWORD='至少12位的密码' \
  pnpm db:seed-admin

# 从反代那一侧验证（走你 Caddy 的公网域名）
curl -fsS https://boke.hiromu.top/api/health
```

不需要为本项目放行 80/443——端口由你已有的反代持有。`scripts/deploy-server.sh` 会自动创建共享网络（见第 3 节），手工首次启动前也可以先建：

```bash
docker network create kirameku-edge
```

访问 GHCR 有两种情况：

- **公开包**（推荐）：在 GitHub 仓库的 Packages 页面把 `kirameku` 包设为 public，服务器无需登录即可 `docker compose pull`。
- **私有包**：GitHub Actions 的 deploy job 会用当次 workflow 的 `GITHUB_TOKEN` 临时 `docker login`（凭据写在临时 `DOCKER_CONFIG` 里，不会留在服务器上）。若希望服务器上也能手工拉取，先执行一次 `docker login ghcr.io -u <你的用户名>`（用带 `read:packages` 的 PAT）。

## 3. 反向代理

### 3.1 你的 Caddy 已经跑在另一个 compose 项目里（默认情况）

容器里的 Caddy **访问不到宿主机的 `127.0.0.1`**，所以两边通过一个外部 Docker 网络对接：

- 本项目 `docker-compose.yml` 把 `app` 接到外部网络 `${SHARED_NETWORK:-kirameku-edge}`，并给它一个固定别名 `kirameku-app`；
- 你的 Caddy 容器也加入这个网络，`reverse_proxy` 直接写容器名。

本项目侧不需要任何额外开关，`docker-compose.yml` 默认就是这个形态。网络由部署脚本保证存在，它不属于任何 compose 项目，所以 `docker compose down` 不会把它删掉、不会把 Caddy 的后端抽走。

在 Caddy 项目的 `docker-compose.yml` 里加：

```yaml
services:
  caddy:
    networks:
      - default
      - kirameku

networks:
  kirameku:
    external: true
    name: kirameku-edge
```

在 Caddy 项目的 `Caddyfile` 里：

```caddyfile
boke.hiromu.top {
	encode zstd gzip
	request_body {
		max_size 12MB
	}
	reverse_proxy kirameku-app:3000
}
```

要点：

- 写 `kirameku-app:3000` 而不是 `app:3000`。`app` 是过于通用的服务名，同一个网络里若有别的项目也这么叫会串。
- **不要**改成 `127.0.0.1:3000`。在容器里那指向 Caddy 自己。
- 证书与 ACME 账号属于你那个 Caddy 项目，本项目完全不碰。
- `reverse_proxy` 会自动带 `X-Forwarded-For` / `X-Forwarded-Proto` / `X-Forwarded-Host`，应用的 `server/http/ip.ts` 与同源校验依赖这些头。
- 不需要在这层加 `Cache-Control`：Next.js 自己已对 `/_next/static/*` 发 `immutable`、对 HTML 发 `s-maxage=60`，Caddy 再设一遍会叠加出两条同名头。
- 如果 Caddy 项目也需要重启（例如加了网络），先起 app 再起 Caddy，或者接受 Caddy 启动瞬间 502。

验收：

```bash
docker network inspect kirameku-edge --format '{{range .Containers}}{{.Name}} {{end}}'
# kirameku-app-1 proxyproject-caddy-1
curl -fsS https://boke.hiromu.top/api/health
```

### 3.2 让本项目自带 Caddy

服务器上没有别的反代时，用 overlay 把 Caddy 加进来（它需要独占 80/443）：

```bash
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
```

`.env` 里要设 `SITE_DOMAIN`。配置在仓库根目录 `Caddyfile`，内容是上文那段 `reverse_proxy kirameku-app:3000`。证书与 ACME 账号存在 `caddy-data` 命名卷里，容器重建不会重新申请。

用这种模式时，自动发布的仓库变量要跟着改：

| 变量 | 值 |
|:--|:--|
| `DEPLOY_COMPOSE_FILE` | `docker-compose.yml docker-compose.caddy.yml` |
| `DEPLOY_SERVICES` | 空（全部，包含 caddy） |

### 3.3 反代装在宿主机上（不是容器）

只有这种模式才需要把端口发布到 loopback：

```bash
docker compose -f docker-compose.yml -f docker-compose.host-proxy.yml up -d app
```

宿主机 Caddy 站点配置：

```caddyfile
boke.hiromu.top {
	encode zstd gzip
	request_body {
		max_size 12MB
	}
	reverse_proxy 127.0.0.1:3000
}
```

对应的 Nginx 等价配置：

```nginx
server {
    listen 443 ssl http2;
    server_name boke.hiromu.top;
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

用这种模式时，自动发布的仓库变量要跟着改：

| 变量 | 值 |
|:--|:--|
| `DEPLOY_COMPOSE_FILE` | `docker-compose.yml docker-compose.host-proxy.yml` |
| `DEPLOY_SERVICES` | `app` |

## 4. GitHub Actions 自动发布

工作流：`.github/workflows/release.yml`（push 到 `main` 或打 `v*` tag 时触发）。

1. `verify`：复用 `verify.yml`，跑 typecheck、单测、空库迁移和生产构建。任一步失败就不会出镜像。
2. `image`：`docker/build-push-action` 构建 `linux/amd64` + `linux/arm64`，推送到 `ghcr.io/<owner>/kirameku`。
   - 标签：`latest`（仅默认分支）、`v1.2.3`（打 tag 时）、`sha-<短commit>`。
   - 构建缓存用 GitHub Actions 缓存（`type=gha`），后续构建通常几分钟内完成。
   - 只部署 x86_64 时，把 `platforms` 里的 `linux/arm64` 去掉可省一半时间。
3. `deploy`：仅在 `main` 分支执行，通过 SSH 把 `scripts/deploy-server.sh` 送过去执行。

### 4.1 需要的仓库配置

Secrets（Settings → Secrets and variables → Actions → Secrets）：

| 名称 | 说明 |
|:--|:--|
| `DEPLOY_HOST` | 服务器地址 |
| `DEPLOY_USER` | SSH 用户（需要有 docker 权限） |
| `DEPLOY_SSH_KEY` | 部署用私钥（建议单独生成一对，只用于部署） |
| `DEPLOY_PORT` | SSH 端口，可选，默认 22 |
| `DEPLOY_KNOWN_HOSTS` | 可选但推荐。`ssh-keyscan -H <host>` 的输出，可防止中间人。不填则每次自动 `ssh-keyscan` |

Variables（同一页面的 Variables 标签）：

| 名称 | 默认 | 说明 |
|:--|:--|:--|
| `DEPLOY_PATH` | `/srv/kirameku` | 服务器上的 compose 项目目录 |
| `DEPLOY_COMPOSE_FILE` | `docker-compose.yml` | 多文件用空格分隔；反代模式见第 3 节 |
| `DEPLOY_SERVICES` | 空（全部） | 走宿主机反代时填 `app` |
| `DEPLOY_ENABLED` | 空 | 设为 `false` 只构建镜像、不部署 |

共享网络名取自服务器 `.env` 里的 `SHARED_NETWORK`（默认 `kirameku-edge`），不需要设成仓库变量。

生成部署密钥：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./deploy_key -N ""
ssh-copy-id -i ./deploy_key.pub user@your-server
# 私钥内容（含 BEGIN/END 行）粘到 DEPLOY_SSH_KEY
cat deploy_key
```

deploy job 绑定了 GitHub Environment `production`，可以在仓库设置里给它加人工审批或限定分支。

### 4.2 部署脚本做了什么

`scripts/deploy-server.sh` 也可以手工执行（`DEPLOY_PATH` 默认当前目录）：

```bash
cd /srv/kirameku
IMAGE_REF=ghcr.io/<owner>/kirameku:latest bash scripts/deploy-server.sh
```

执行顺序：

1. 校验 `.env` 与 compose 文件存在。
2. 确保共享网络（`SHARED_NETWORK`，默认 `kirameku-edge`）存在，不存在就创建。
3. 记录当前容器的镜像 ID（用于回滚）。
4. `docker compose exec app pnpm db:backup --prune` 备份 SQLite（`BACKUP_BEFORE_DEPLOY=0` 可跳过）。
5. `docker compose pull` → `docker compose up -d`。容器 entrypoint 会先跑 `pnpm db:migrate`。
6. 轮询 `docker inspect` 的 healthcheck 状态（默认 180 秒）。
7. 健康就结束并清理悬空镜像，同时安装/刷新两个 systemd timer（每日维护 `kirameku-maintenance.timer` 见 6.3、每 5 分钟健康探针 `kirameku-probe.timer` 见 6.6）；不健康则打印日志，用上一个镜像 ID `up -d --pull never --force-recreate`，再检查一次健康，最终仍以非 0 退出。

## 5. 日常发布与回滚

正常流程不需要登服务器：

```bash
git push origin main     # 触发 CI → 镜像 → 自动部署
```

手工回滚到上一个镜像：

```bash
cd /srv/kirameku
docker images ghcr.io/<owner>/kirameku   # 找 sha-xxxx 标签
IMAGE_REF=ghcr.io/<owner>/kirameku:sha-abc1234 \
  bash scripts/deploy-server.sh
```

回滚到某个发布 tag 同理（`IMAGE_REF=...:v1.2.3`）。镜像会保留最近几次构建；`sha-` 标签是稳定引用，`latest` 会被覆盖。

紧急停写不停止服务：把 `.env` 里的 `SITE_READ_ONLY` 改为 `1`，然后 `docker compose up -d app`。

## 6. 备份、恢复与维护命令

一次备份产出一个**组**，三个文件同前缀：

| 文件 | 内容 |
|:---|:---|
| `kirameku-<时间戳>.db` | SQLite 一致性快照（用 backup API，不是 `cp`） |
| `kirameku-<时间戳>.db.meta.json` | 行数、完整性检查结果、uploads 归档的 sha256 与文件数 |
| `kirameku-<时间戳>-uploads.tar.gz` | `UPLOAD_DIR` 的归档；配了 OSS 时为空，`--no-uploads` 可跳过 |

```bash
# 在线备份到 /data/backups（含 uploads 归档），并按保留策略清理旧组
docker compose exec app pnpm db:backup --prune

# 只要数据库、不要图（配了 OSS 时用）
docker compose exec app pnpm db:backup --prune --no-uploads

# 查看备份文件
docker compose exec app ls -lh /data/backups

# 恢复数据库（先停应用，禁用 entrypoint 迁移）
docker compose stop app
docker compose run --rm -e RUN_MIGRATIONS=0 app \
  pnpm db:restore /data/backups/kirameku-....db --target /data/db/kirameku.db
# 同一组里的图片一起恢复（校验 meta 里的 sha256 后才解包）
docker compose run --rm -e RUN_MIGRATIONS=0 app \
  pnpm db:restore /data/backups/kirameku-....db --target /data/db/kirameku.db --with-uploads
docker compose start app
```

- 一次性维护命令加 `-e RUN_MIGRATIONS=0`，避免 entrypoint 在 restore 前先改动数据库。
- 保留策略：最近 14 天每天留一组，再往前每 ISO 周留一组（最多 8 周）。`--prune` 成组删除，不会留下半套文件。
- uploads 归档失败不会让 `db:backup` 以非 0 退出（部署脚本把非 0 当成「完全没有备份」），失败原因写在 `.db.meta.json` 的 `uploadsError` 里。
- 备份文件建议再同步到对象存储，并定期做一次恢复演练。

### 6.1 数据目录（bind mount）

数据不放在命名卷里，而是直接挂在宿主机目录，容器内的 `/data` 被拆成两个挂载点：

| 宿主机 | 容器内 | 内容 |
|:---|:---|:---|
| `./data/db/kirameku.db` | `/data/db/kirameku.db` | SQLite（含 `-wal` / `-shm`） |
| `./data/uploads/` | `/data/uploads` | 本地图片（未配 OSS 时） |
| `./backup/` | `/data/backups` | `pnpm db:backup` 的输出 |

相对路径以 compose 项目目录为基准；用 `.env` 的 `KIRAMEKU_DATA_DIR` / `KIRAMEKU_BACKUP_DIR` 可以改到别处（例如独立数据盘）。备份独立成一个挂载点，是为了能单独 rsync 走、不带上正在使用的数据库。

容器内进程以 `node`（UID 1000）运行，而 Docker 在 bind mount 的宿主机目录缺失时会用 **root** 创建它——这样容器起得来但写不进数据库。所以这三个目录必须先存在且属主是 1000：

```bash
mkdir -p data/db data/uploads backup
sudo chown -R 1000:1000 data backup
```

`scripts/deploy-server.sh` 每次发布都会以 root 身份进容器补一遍 `mkdir` + `chown`，自动发布路径不需要手工介入；上面的命令只用于手工首次启动。

因为不再依赖命名卷，`docker compose down -v` 也不会删掉数据。反过来，删数据就是普通文件操作，误删没有 `-v` 这道保险，备份目录请勿当成临时目录清理。

### 6.2 从命名卷迁移到宿主机目录

早期部署用的是 `kirameku-data` 命名卷。迁移必须在停机状态下用容器把文件复制到宿主机目录，`cp` 活的 SQLite 文件会得到损坏的库：

```bash
docker compose stop app
mkdir -p data/db data/uploads backup
# 用一次性容器把卷内容灌进新建的宿主目录，-a 保留属主
docker run --rm \
  -v kirameku_kirameku-data:/from:ro \
  -v "$PWD/data:/to-data" -v "$PWD/backup:/to-backup" \
  alpine sh -c 'cp -a /from/db /from/uploads /to-data/ && cp -a /from/backups/. /to-backup/'
sudo chown -R 1000:1000 data backup
docker compose up -d
```

起来后用 `/api/health` 确认 `db: ok`，再核对文章数和管理员能登录。确认无误后再删旧卷（`docker volume rm kirameku_kirameku-data`）；**删之前先留一份 `pnpm db:backup` 产物**。

SQLite 使用 WAL，运行中不要直接 `cp` 数据库文件；要取一致性副本就用 `pnpm db:backup`。

### 6.3 定时维护（systemd timer）

备份、访客 IP 清理、计数校正都不再依赖「有人发版」：`scripts/deploy-server.sh` 每次成功发布会安装/刷新一个 systemd timer，每天跑一次 `scripts/maintenance.sh`。

脚本做三件事，任何一步失败都会让这次运行以非 0 退出并写进日志：

1. `pnpm db:backup --prune`（数据库 + uploads 归档 + 保留策略）；
2. `pnpm db:prune-visitors`（按 `VISITOR_RETENTION_DAYS` 清理访客 IP）；
3. `pnpm db:reconcile-counts`（校正文章/项目的计数冗余字段）。

```bash
# 看 timer 状态与下次触发时间
systemctl list-timers kirameku-maintenance.timer
systemctl status kirameku-maintenance.service --no-pager

# 看维护日志（按大小自动滚动到 maintenance.log.1）
tail -n 50 logs/maintenance.log

# 立刻手动跑一次（与 timer 共用 flock，不会并发）
bash scripts/maintenance.sh
```

时间与开关都在 `.env` 里：`MAINTENANCE_TIMER=0` 关掉，`MAINTENANCE_SCHEDULE=*-*-* 05:00:00` 改时间（改完重新发布一次让它重写 unit，或手动 `systemctl daemon-reload`）。

服务器没有免密 sudo 时，部署日志会打 `WARNING: passwordless sudo unavailable; skipping maintenance timer install` 并继续发布。这种情况下用 cron 顶上：

```cron
30 4 * * * cd /home/ubuntu/services/Kirameku-Lite && DEPLOY_PATH=$PWD bash scripts/maintenance.sh
```

### 6.4 容器日志上限

`docker-compose.yml` 给 app 服务配了 json-file 轮转，默认单文件 100 MB、保留 3 份（上限约 300 MB），不配置的话日志会一直涨到磁盘满：

```yaml
logging:
  driver: json-file
  options:
    max-size: ${KIRAMEKU_LOG_MAX_SIZE:-100m}
    max-file: "${KIRAMEKU_LOG_MAX_FILE:-3}"
```

改完 `docker compose up -d` 会重建容器，新参数生效。查看：

日志由 Docker 的日志驱动保存（不在容器文件系统里），所以只看得到有限的历史：

```bash
docker compose logs --tail 200 app
docker compose logs --since 1h app | grep -i error
```

### 6.5 可观测入口

| 入口 | 用途 |
|:---|:---|
| `GET /api/health` | 存活 + 数据库 + 迁移版本，反代/容器 healthcheck 用它 |
| `GET /api/internal/metrics` | 进程、请求、数据库、备份、磁盘快照；需要 `CRON_SECRET` |
| `logs/maintenance.log` | 每日维护输出 |
| `systemctl list-timers kirameku-maintenance.timer` | 定时任务是否还活着 |
| `logs/probe.log` | 外部探针每次探测的输出（失败次数、投递结果，见 6.6） |
| `systemctl list-timers kirameku-probe.timer` | 健康探针是否还活着（见 6.6） |

metrics 默认对外 404，只有在 `.env` 里配了 `CRON_SECRET` 才存在，且要带令牌访问：

```bash
curl -sH "Authorization: Bearer $CRON_SECRET" https://blog.yawanaika.com/api/internal/metrics | jq
```

返回里和运维直接相关的是 `backups` 与 `disk`：

- `backups.latest_age_s`：最近一次备份至今的秒数，超过 26 小时就说明 timer 没跑成；
- `backups.uploads_archives`：带图片归档的备份组数，配了 OSS 时它是 0；
- `disk.available_bytes`：数据盘剩余空间（磁盘告警已由预警通知系统的 `disk.low` 规则接管，见 6.6）。

### 6.6 外部健康探针

站点自己的告警链路有一个结构性盲区：**所有通知都要经由站点投递**（`/api/internal/notify` 就在这台机器上），进程内的 `site.health` 自检也只看得见 Node 进程自己。于是「容器没起来 / 反代 502 / Tunnel 断了 / 整机宕机」这几种最需要有人知道的情况，恰恰一条告警都发不出来。补两个探针，故障域不同，都要配：

| 探针 | 位置 | 覆盖 | 部署 |
|:---|:---|:---|:---|
| 进程内 `site.health` | 通知调度器 | 应用与数据库自检 | 已随预警通知系统上线 |
| **B 同机** | systemd timer | 反代 502、Tunnel 断开、容器 unhealthy | 每次发布自动安装 |
| **A 站外** | Cloudflare Worker + Cron Trigger | 反代/Tunnel/容器/整机全挂（Telegram 直连兜底） | 手动部署一次，见 `ops/cloudflare-probe/` |

**B：同机探针（发布时自动安装）**

每次成功发布会安装/刷新 `kirameku-probe.timer`，每 5 分钟执行一次 `scripts/probe-health.sh`：请求公网 `${SITE_URL}/api/health`，连续 `PROBE_FAIL_THRESHOLD`（默认 2）次失败后 POST `/api/internal/notify`（事件 `site.health`，服务端有 900s 冷却），恢复后再补一条「已恢复」。

投递**优先走容器在 docker 网络上的地址**（`docker inspect` 取 IP + 3000 端口），而不是公网域名：反代坏掉时公网路径同样投不出去，而这一层正是探针要覆盖的。

```bash
# 状态与下次触发时间
systemctl list-timers kirameku-probe.timer
systemctl status kirameku-probe.service --no-pager

# 每次探测一行，含 http 状态、连续失败次数与投递结果
tail -n 50 logs/probe.log
# 内部状态（连续失败次数 / 是否已告警），排查闪烁时看这个
cat logs/.probe-state

# 手工探测一次：只报告、不发通知
bash scripts/probe-health.sh --dry-run
```

开关与频率在 `.env`：`PROBE_TIMER=0` 关掉，`PROBE_SCHEDULE=*-*-* *:0/10:00` 改成 10 分钟（改完重新发布一次让它重写 unit）。探针需要 `CRON_SECRET` 才能投递，没配时它只写日志。

要**立即**停用还要 `sudo systemctl disable --now kirameku-probe.timer`（unit 文件保留，`sudo systemctl enable --now kirameku-probe.timer` 即可恢复）：`.env` 里的 `PROBE_TIMER=0` 只保证下次发布不再装回来 —— 不加它的话，下一次 push `main` 触发的发布会把它重新启用。

脚本只用 `curl` / `flock` / `docker` 这些标准工具，不依赖 node；`flock` 是 util-linux 的东西，所以开发机上手工跑会打一行 `WARNING: flock not found` 并降级为不加锁运行（服务器上不会出现这行）。

服务器没有免密 sudo 时，部署会打 `WARNING: passwordless sudo unavailable; skipping health probe timer install` 并继续，这时用 cron 顶上：

```cron
*/5 * * * * cd /home/ubuntu/services/Kirameku-Lite && DEPLOY_PATH=$PWD bash scripts/probe-health.sh
```

**B 有没有真的装上（这次踩到的坑）**

发布脚本 `scripts/deploy-server.sh` 是**流式**送给服务器执行的（CI 里 `cat … | ssh … bash -s`），所以服务器跑的是新版脚本，
但**工作树不一定跟着更新**：`PULL_GIT` 默认 0，镜像会更新、仓库里新增的文件不会。`install_probe_timer` 找不到
`scripts/probe-health.sh` 时只打一行 `WARNING: scripts/probe-health.sh missing, no probe timer` 就返回 ——
现象是「发布成功、timer 却没有」。2026-10-24 第一次就漏在这里。判断与补救：

```bash
# 没装的话这里是 NotFound；文件不在 = 服务器工作树没更新
systemctl status kirameku-probe.timer --no-pager
ls -l scripts/probe-health.sh

# 补齐：先拉工作树，再只装 timer（不重启容器、不碰镜像）
cd /home/ubuntu/services/Kirameku-Lite
git pull --ff-only
COMPOSE_FILES=docker-compose.yml bash -c \
  'eval "$(sed -n "/^install_probe_timer()/,/^}/p" scripts/deploy-server.sh)"; install_probe_timer'
```

长期办法是在服务器 `.env` 里设 `PULL_GIT=1`（见 §7），让每次发布先拉工作树，新增的脚本与覆盖文件才会一起到位。

**A：站外探针（单独部署一次）**

同机探针和站点共用一个故障域：机器整机挂掉时它什么都发不出去。站外的 Cloudflare Worker 补的正是这一格 —— 从边缘每 5 分钟请求一次公网 `/api/health`，失败后先立即重试一次，仍失败才 POST `/api/internal/notify`；**连通知端点也投不出去时用 Telegram Bot API 直连兜底**。部署见 [`ops/cloudflare-probe/README.md`](./ops/cloudflare-probe/README.md)，需要 `wrangler` 与一次 `wrangler secret put CRON_SECRET`（值与服务器 `.env` 相同）。

**生产状态（2026-10-24）**：Worker `kirameku-lite` 已部署在 `https://kirameku-lite.yawanaika.workers.dev`（cron `*/5 * * * *` 已注册），D1 数据库 `kirameku-lite`（表 `probe_alerts`）已绑定为 `PROBE_DB` —— v1 用的 KV `PROBE_STATE` 已退役。手动触发只能在能访问 `*.workers.dev` 的机器上做（本机大陆网络直连超时），命令、绑定注意事项与 `inherit` 这个坑见该 README 的「当前生产状态」一节。

**这套设计的边界（写在这里省得以后误判）**：两个探针的告警最终都经由 `/api/internal/notify`，所以「站点整体不可达」时只有 A 的 Telegram 直连兜底送得出去；B 会在 `logs/probe.log` 里留一行 `WARNING: no delivery path worked`。这是设计的边界，不是配置问题。

## 7. 环境变量

完整清单见 `compose.env.example`（Compose 部署）与 `Kirameku/.env.example`（裸机开发）。关键项：

| 变量 | 说明 |
|:---|:---|
| `DATABASE_PATH` | SQLite 文件路径；容器内固定 `/data/db/kirameku.db` |
| `SHARED_NETWORK` | 与反代共享的 Docker 网络，默认 `kirameku-edge`；部署脚本会自动创建 |
| `SITE_DOMAIN` | 仅本项目自带 Caddy 时需要：Caddy 用它申请证书并建站点 |
| `AUTH_SECRET` | 管理员 JWT 签名密钥，≥32 字符 |
| `SITE_READ_ONLY` | `1` 时拒绝公开写接口，适合迁移/维护窗口 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth 登录（访客评论/点赞） |
| `GITHUB_REDIRECT_URI` | 必须与 GitHub OAuth App 回调地址一致 |
| `FRONTEND_ORIGIN` | 同源校验使用；生产填正式 HTTPS 域名 |
| `UPLOAD_DIR` | 未配置 OSS 时的本地图片目录 |
| `OSS_*` | 配置完整后图片写入阿里云 OSS |
| `VISITOR_RETENTION_DAYS` | 访客 IP 记录保留天数，默认 90 |
| `KIRAMEKU_IMAGE` | 可选，覆盖默认镜像标签；回滚脚本会临时设置它 |
| `PROBE_TIMER` / `PROBE_SCHEDULE` | 同机健康探针的开关与频率，默认每 5 分钟（见 6.6） |
| `PROBE_FAIL_THRESHOLD` | 连续失败几次才告警，默认 2（见 6.6） |
| `PULL_GIT` | `1` = 每次发布先 `git pull --ff-only`；仓库里新增的脚本与覆盖文件才会随发布到达服务器工作树（默认 0，踩坑见 6.6） |

数据库维护脚本不会自动加载 `.env.local`；用非默认路径时在命令前显式传 `DATABASE_PATH`。

## 8. 不使用容器的裸机部署

要求 Node.js 22、pnpm 12。

```bash
cd Kirameku
pnpm install --frozen-lockfile

cp .env.example .env.local
# 至少填写：
#   AUTH_SECRET（≥32 字符，openssl rand -base64 48）
#   DATABASE_PATH=/data/kirameku.db
#   UPLOAD_DIR=/data/uploads
# 可选：GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_REDIRECT_URI
# 可选：OSS_*（配置完整后图片写入 OSS）

pnpm db:migrate

ADMIN_USERNAME=admin \
ADMIN_PASSWORD='至少12位的密码' \
pnpm db:seed-admin

pnpm build
DATABASE_PATH=/data/kirameku.db pnpm start
```

此时反代直接在本机，用第 3.3 节的宿主机配置反代到 `127.0.0.1:3000`（容器模式下要改用第 3.1 节的共享网络）。检查：

```bash
curl -s http://127.0.0.1:3000/api/health
# {"ok":true,"db":"ok","migration":"0002_admin_audit_indexes.sql",...}
```

`/api/health` 会返回数据库状态、最新迁移、认证配置、uptime 和数据库大小；部署脚本应把它作为健康检查。

新增迁移只允许**追加** `server/db/migrations/*.sql`；迁移执行器会校验已应用文件的 SHA-256，改旧文件会导致启动/迁移失败。

## 9. 常见问题

### 页面引用了旧 chunk / Mixed Content

旧架构曾出现 `http://boke.hiromu.top:8000/...` 的混合内容错误。现在已没有 8000 端口和 `/api` 反代；如果再次出现类似问题，按顺序检查：

1. 页面 HTML 是否被 CDN 或宿主机反代强缓存，仍引用旧构建的 chunk。本仓库的 Caddyfile **不**改写任何缓存头（Next.js 自己已对 `/_next/static/*` 发 `immutable`，对 HTML 发 `s-maxage=60`）；如果你在宿主机外面又套了一层 CDN，那层的规则要单独检查。
2. 环境变量或前端代码里是否残留 `http://`、`localhost:8000`、`127.0.0.1:8000`。
3. 确认 `FRONTEND_ORIGIN`、`GITHUB_REDIRECT_URI` 使用正式 HTTPS 域名。

### 自动部署失败

- Actions 里 `deploy` job 报 SSH 相关错误：检查 `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY`，以及 `DEPLOY_KNOWN_HOSTS` 是否与服务器主机指纹一致（服务器重装后会变）。
- 报 `permission denied while trying to connect to the Docker daemon`：`DEPLOY_USER` 不在 `docker` 组。
- 报 `unauthorized` 拉不到镜像：包是私有的且 `GITHUB_TOKEN` 没有 `packages:read`。确认 workflow 顶部的 `permissions` 没被改掉。
- 部署脚本以非 0 退出时 workflow 会标红，但**服务通常已经回滚到上一个可用镜像**；查看日志里 `[deploy]` 开头的行。

### 容器一直 unhealthy

- `docker compose logs app`。entrypoint 里的 `pnpm db:migrate` 失败最常见，通常是迁移文件被改动（SHA-256 校验不通过）或数据卷权限不对。
- `docker compose exec app ls -ld /data/db` 应属于 `node`(1000)。

### SQLite 写入失败 / `database is locked`

- 确认只有一个 Node 实例写同一个 `DATABASE_PATH`。
- 不要把数据库文件放在 NFS、SMB 或跨容器共享卷上。
- 检查是否有外部脚本长时间持有事务；维护脚本应在低峰运行。
- 备份用 `pnpm db:backup`，不要在写入时 `cp`。

### 上传图片 404

- 未配置 OSS 时确认 `UPLOAD_DIR` 指向持久目录，且 Node 进程有读写权限。
- 如果用反代 `alias` 直出，确认路径和 `UPLOAD_DIR` 一致。
- 检查文件是否被部署脚本清掉；上传目录不能放在临时构建目录里。

### Caddy 报 `dial tcp: lookup kirameku-app ... no such host` 或一直 502

反代容器和应用不在同一个 Docker 网络里。逐层查：

```bash
# 1. 网络存在吗
docker network ls | grep kirameku-edge

# 2. 两边都在这个网络里吗（应同时出现 kirameku-app-1 和你的 caddy 容器）
docker network inspect kirameku-edge --format '{{range .Containers}}{{.Name}} {{end}}'

# 3. 应用在这个网络上用这个别名能解析吗
docker compose -f <caddy项目的compose> exec caddy getent hosts kirameku-app

# 4. 应用自己健康吗
docker compose exec app wget -qO- http://127.0.0.1:3000/api/health
```

常见原因：

- Caddy 项目的 compose 里加了 `networks:` 但没把 caddy 服务列进去，或忘了写 `external: true` / `name: kirameku-edge`（只写 key 名会变成 `<项目名>_kirameku-edge`，对不上）。
- 应用侧 `SHARED_NETWORK` 和 Caddy 侧 `name:` 不一致。两边都用同一个值最省事。
- 应用刚重建时，Caddy 需要重新解析后端 IP。Caddy v2 会对 `reverse_proxy` 的上游做动态解析，实测重新部署后**不需要**重启 Caddy 就能恢复 200；如果恰好撞上重连窗口，可能短暂 502，等几秒即可。
- 本机 Docker Desktop / OrbStack 上如果两边的 daemon 不是同一个，网络天然不通——多机部署要用真实共享网络或改回 `127.0.0.1` 发布端口。

### 改了 Caddyfile 但不生效

`docker-compose.caddy.yml` 把 `Caddyfile` 以**单文件** bind mount 方式挂进容器（只在本项目自带 Caddy 时相关）。这类挂载绑定的是 inode：如果你在宿主机上编辑保存时编辑器换了新文件（大多数编辑器保存时都是写临时文件再 rename），容器里那个路径就会指向一个已经不存在的 inode，表现为：

```console
$ docker compose exec caddy ls -la /etc/caddy
# 目录里空空如也，Caddyfile 不见了
$ docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
{"level":"error","msg":"reading config from file: open /etc/caddy/Caddyfile: no such file or directory"}
```

已经启动的 Caddy 进程不受影响（配置在启动时就读进内存了），但 `caddy reload` / `caddy validate` 会失败。处理办法是让 Docker 重新解析源路径：

```bash
docker compose up -d --force-recreate caddy
```

容器重建后文件就回来了，然后可以正常 `caddy reload`。**注意 `docker compose up -d` 不会因为文件内容变化而重建 caddy**，所以每次修改 `Caddyfile`（或从 git 拉到一个新版本）都要显式 `--force-recreate caddy`。

条目名容易误导：这个坑只在 Caddy 跑在本项目里时存在。如果你的 Caddy 在独立项目里（第 3.1 节），改的是那个项目的 Caddyfile，`--force-recreate caddy` 也要在那边执行。

### 后台登录失败

- `AUTH_SECRET` 是否 ≥32 字符，且发布前后保持一致；修改会让现有管理员会话失效。
- 管理员账号是否通过 `pnpm db:seed-admin` 创建；没有默认密码。
- 反向代理是否传递了正确的 `Host`、`X-Forwarded-Proto`，以及 `FRONTEND_ORIGIN` 是否匹配。

## 10. 旧架构清理记录

2026-10-22 已完成：

- 删除 `Kirameku-backend/`（FastAPI + Vue 后台 + `init_db.sql`）。
- 删除 `Kirameku/scripts/migrate/`（PostgreSQL 结构审计与一次性导入）。
- 移除 `postgres` devDependency 和 `migrate:audit` / `migrate:pg2sqlite` 脚本。
- 移除文档和注释中的旧后端部署指引；`README.md`、`AGENTS.md`、`server/db/README.md` 以当前单进程架构为准。
- 入口反代由 Nginx 切换为 Caddy；镜像改为 CI 构建 + GHCR 分发，服务器只拉取镜像。
- 反代改为独立 compose 项目持有：本项目不再发布宿主机端口，应用通过外部网络 `kirameku-edge` 以 `kirameku-app:3000` 暴露给现有 Caddy；本项目自带 Caddy 改为 opt-in（`docker-compose.caddy.yml`）。

Git 历史仍保留旧代码和迁移脚本；如果未来需要查阅，只能从历史提交恢复，不要在生产重新引入第二套运行时。
