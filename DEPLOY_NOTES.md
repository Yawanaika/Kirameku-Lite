# Kirameku 部署与运维记录

> **2026-10-22 架构现状**
>
> 旧版 `Kirameku-backend/`（FastAPI + Vue 管理后台 + PostgreSQL）及 PostgreSQL → SQLite 一次性迁移脚本已经删除。当前生产只有一个 Node.js 进程、一个 SQLite 文件和一个 Caddy 入口。
>
> 镜像由 GitHub Actions 构建并推送到 GHCR，服务器上只做 `docker compose pull` + `up -d`，不编译任何代码。

## 1. 当前架构

```text
浏览器
  └── Caddy（HTTPS 自动证书、上传大小限制）        ← docker compose 服务，或宿主机 Caddy
        └── Next.js 16 容器（Node 22，内部 3000）   ← 从 GHCR 拉取的镜像
              ├── 前台页面 / RSC / RSS / sitemap
              ├── /admin 后台页面
              ├── /api/* Route Handlers
              ├── /uploads/* 本地图片读取（未配置 OSS 时）
              └── SQLite（WAL，单文件，命名卷 kirameku-data）
```

发布链路：

```text
push to main
  └── GitHub Actions
        ├── verify：typecheck → test → db:migrate → build
        ├── image ：buildx 构建 linux/amd64 + linux/arm64 → 推送 ghcr.io/<owner>/kirameku
        └── deploy：SSH 到服务器 → scripts/deploy-server.sh
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

## 2. 服务器一次性初始化

要求：Docker Engine 24+ 与 Compose v2（`docker compose version` 可用），80/443 端口可从公网访问。

```bash
sudo mkdir -p /srv/kirameku
sudo chown "$USER":"$USER" /srv/kirameku
cd /srv/kirameku

# compose 文件、Caddyfile 与部署脚本都来自仓库
git clone https://github.com/<owner>/Kirameku-HomePage.git .
# 或只同步需要的文件：
#   docker-compose.yml、Caddyfile、compose.env.example、scripts/deploy-server.sh

cp compose.env.example .env
# 必填：
#   SITE_DOMAIN=boke.hiromu.top
#   AUTH_SECRET=$(openssl rand -base64 48)
#   FRONTEND_ORIGIN=https://boke.hiromu.top
# 按需：CRON_SECRET / GITHUB_* / OSS_*

docker compose pull
docker compose up -d

# 首次创建管理员（不提供默认密码）
docker compose exec app \
  env ADMIN_USERNAME=admin ADMIN_PASSWORD='至少12位的密码' \
  pnpm db:seed-admin

curl -fsS https://boke.hiromu.top/api/health
```

防火墙只放行 SSH、80、443：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp   # HTTP/3，可选
```

访问 GHCR 有两种情况：

- **公开包**（推荐）：在 GitHub 仓库的 Packages 页面把 `kirameku` 包设为 public，服务器无需登录即可 `docker compose pull`。
- **私有包**：GitHub Actions 的 deploy job 会用当次 workflow 的 `GITHUB_TOKEN` 临时 `docker login`（凭据写在临时 `DOCKER_CONFIG` 里，不会留在服务器上）。若希望服务器上也能手工拉取，先执行一次 `docker login ghcr.io -u <你的用户名>`（用带 `read:packages` 的 PAT）。

## 3. Caddy

默认由 `docker-compose.yml` 自带一个 `caddy` 服务，配置在仓库根目录 `Caddyfile`：

```caddyfile
{$SITE_DOMAIN} {
	encode zstd gzip
	request_body {
		max_size 12MB
	}
	@immutable path /_next/static/*
	header @immutable Cache-Control "public, max-age=31536000, immutable"
	reverse_proxy app:3000
}
```

要点：

- 证书自动申请与续期，ACME 账号与证书存在 `caddy-data` 命名卷里，容器重建不会重新申请。
- `reverse_proxy` 会自动带上 `X-Forwarded-For` / `X-Forwarded-Proto` / `X-Forwarded-Host`，应用的 `server/http/ip.ts` 与同源校验依赖这些头。
- 只对 `/_next/static/*` 长缓存；HTML 与 API 保留应用自己发的 `Cache-Control`，避免发布后引用旧 chunk。
- 想接收证书到期提醒，取消 `Caddyfile` 顶部的 `email` 段注释并在 `.env` 里设 `ACME_EMAIL`。

### 3.1 已经有宿主机 Caddy

如果宿主机上已经跑着 Caddy（或切回 Nginx），不要启动 compose 里的 `caddy` 服务，只起 `app` 并让它在 loopback 暴露端口：

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
	@immutable path /_next/static/*
	header @immutable Cache-Control "public, max-age=31536000, immutable"
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

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
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
| `DEPLOY_COMPOSE_FILE` | `docker-compose.yml` | 多文件用空格分隔 |
| `DEPLOY_SERVICES` | 空（全部） | 走宿主机反代时填 `app` |
| `DEPLOY_ENABLED` | 空 | 设为 `false` 只构建镜像、不部署 |

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
2. 记录当前容器的镜像 ID（用于回滚）。
3. `docker compose exec app pnpm db:backup --prune` 备份 SQLite（`BACKUP_BEFORE_DEPLOY=0` 可跳过）。
4. `docker compose pull` → `docker compose up -d`。容器 entrypoint 会先跑 `pnpm db:migrate`。
5. 轮询 `docker inspect` 的 healthcheck 状态（默认 180 秒）。
6. 健康就结束并清理悬空镜像；不健康则打印日志，用上一个镜像 ID 重新 `up -d`，再检查一次健康。

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

```bash
# 在线备份到 /data/backups
docker compose exec app pnpm db:backup --prune

# 查看备份文件
docker compose exec app ls -lh /data/backups

# 恢复：先停应用，禁用 entrypoint 迁移，再执行 restore
docker compose stop app
docker compose run --rm -e RUN_MIGRATIONS=0 app \
  pnpm db:restore /data/backups/kirameku-....db --target /data/db/kirameku.db
docker compose start app
```

- 一次性维护命令加 `-e RUN_MIGRATIONS=0`，避免 entrypoint 在 restore 前先改动数据库。
- `docker compose down` 不会删除命名卷；只有 `docker compose down -v` 才会删除。生产环境不要随手加 `-v`。
- 备份文件建议再同步到对象存储，并定期做一次恢复演练。

### 6.1 改用宿主机目录

如果需要在宿主机直接看到数据库和上传文件，可把命名卷换成 bind mount，并让目录属主对应容器内的 `node` 用户（UID 1000）：

```bash
mkdir -p data/db data/uploads data/backups
sudo chown -R 1000:1000 data
```

```yaml
    volumes:
      - ./data:/data
```

改动挂载前先停容器并备份；SQLite 使用 WAL，运行中不要直接 `cp` 数据库文件。

## 7. 环境变量

完整清单见 `compose.env.example`（Compose 部署）与 `Kirameku/.env.example`（裸机开发）。关键项：

| 变量 | 说明 |
|:---|:---|
| `SITE_DOMAIN` | 对外域名，Caddy 用它申请证书并建站点 |
| `DATABASE_PATH` | SQLite 文件路径；容器内固定 `/data/db/kirameku.db` |
| `AUTH_SECRET` | 管理员 JWT 签名密钥，≥32 字符 |
| `SITE_READ_ONLY` | `1` 时拒绝公开写接口，适合迁移/维护窗口 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth 登录（访客评论/点赞） |
| `GITHUB_REDIRECT_URI` | 必须与 GitHub OAuth App 回调地址一致 |
| `FRONTEND_ORIGIN` | 同源校验使用；生产填正式 HTTPS 域名 |
| `UPLOAD_DIR` | 未配置 OSS 时的本地图片目录 |
| `OSS_*` | 配置完整后图片写入阿里云 OSS |
| `VISITOR_RETENTION_DAYS` | 访客 IP 记录保留天数，默认 90 |
| `KIRAMEKU_IMAGE` | 可选，覆盖默认镜像标签；回滚脚本会临时设置它 |

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

此时 Caddy 需要用第 3.1 节的宿主机配置反代到 `127.0.0.1:3000`。检查：

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

### 改了 Caddyfile 但不生效

`docker-compose.yml` 把 `Caddyfile` 以**单文件** bind mount 方式挂进容器。这类挂载绑定的是 inode：如果你在宿主机上编辑保存时编辑器换了新文件（大多数编辑器保存时都是写临时文件再 rename），容器里那个路径就会指向一个已经不存在的 inode，表现为：

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

Git 历史仍保留旧代码和迁移脚本；如果未来需要查阅，只能从历史提交恢复，不要在生产重新引入第二套运行时。
