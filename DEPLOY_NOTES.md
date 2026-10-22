# Kirameku 部署与运维记录

> **2026-10-22 架构现状**
>
> 旧版 `Kirameku-backend/`（FastAPI + Vue 管理后台 + PostgreSQL）及 PostgreSQL → SQLite 一次性迁移脚本已经删除。当前生产只有一个 Node.js 进程、一个 SQLite 文件和一个 Nginx 入口。
>
> 本文下方不再保留 `:8000` 反代、Vue 后台或 PostgreSQL 的部署步骤；这些内容只存在于 Git 历史和 `docs/` 的阶段记录中。

## 1. 当前架构

```text
浏览器
  └── Nginx（HTTPS、静态缓存、上传大小限制）
        └── Next.js 16（Node 22，默认 3000）
              ├── 前台页面 / RSC / RSS / sitemap
              ├── /admin 后台页面
              ├── /api/* Route Handlers
              ├── /uploads/* 本地图片读取（未配置 OSS 时）
              └── SQLite（WAL，单文件）
```

约束：

- **只能跑一个写实例。** SQLite 是单写者，不能开多个 Node 实例同时写同一个数据库文件，也不能把数据库放在 NFS 上。
- **不要直接 `cp` 正在使用的数据库。** 使用 `pnpm db:backup` / `pnpm db:restore`；恢复前先停应用。
- **图片目录要持久化。** 未配置 OSS 时，上传文件写入 `UPLOAD_DIR`（默认 `./uploads`）；容器/重新部署不能把它清掉。
- **不要再加 `/api` 反代。** `next.config.mjs` 没有 rewrites，未命中的 `/api/*`、`/uploads/*` 会直接 404；缺少接口时应该补 Route Handler，而不是转发到旧服务。

## 2. 首次部署

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

检查：

```bash
curl -s http://127.0.0.1:3000/api/health
# {"ok":true,"db":"ok","migration":"0002_admin_audit_indexes.sql",...}
```

`/api/health` 会返回数据库状态、最新迁移、认证配置、uptime 和数据库大小；部署脚本应把它作为健康检查。

## 3. Nginx 参考

```nginx
server {
    listen 443 ssl http2;
    server_name boke.hiromu.top;

    # 上传接口限制；应用侧也有 10MB 文件校验
    client_max_body_size 12m;

    # 不要把 HTML 缓存到 Nginx/CDN；否则发布后可能引用旧 chunk
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

    # Next 带 hash 的静态资源可以长缓存；交给浏览器/CDN 缓存即可
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 可选：本地上传目录直接由 Nginx 提供，减轻 Node 压力
    # location /uploads/ {
    #     alias /data/uploads/;
    #     try_files $uri =404;
    #     add_header X-Content-Type-Options nosniff;
    # }
}
```

如果使用 Nginx `alias` 直接服务 `/uploads/`，要确保目录只包含应用写入的图片，并保留 `X-Content-Type-Options: nosniff`。不配置时，Next 的 `app/uploads/[...path]/route.ts` 会兜底读取。

## 4. 发布流程

```bash
cd Kirameku
git pull --ff-only

pnpm install --frozen-lockfile
DATABASE_PATH=/data/kirameku.db pnpm db:migrate
pnpm build

# 重启 Node 进程（systemd / pm2 / 容器按实际环境）
sudo systemctl restart kirameku

curl -fsS https://boke.hiromu.top/api/health
```

发布前建议先备份：

```bash
DATABASE_PATH=/data/kirameku.db BACKUP_DIR=/data/backups pnpm db:backup --prune
```

新增迁移只允许**追加** `server/db/migrations/*.sql`；迁移执行器会校验已应用文件的 SHA-256，改旧文件会导致启动/迁移失败。

## 5. Docker Compose 部署（可选）

仓库根目录提供 `docker-compose.yml` 和 `Kirameku/Dockerfile`。镜像内只有一个 Node 进程；SQLite、上传文件和备份都在命名卷里，适合不想在宿主机安装 Node/pnpm 的环境。

### 5.1 首次启动

```bash
cp compose.env.example .env
# 必填 AUTH_SECRET（≥32 字符，openssl rand -base64 48）
# 按需填写 FRONTEND_ORIGIN / GITHUB_* / OSS_*

docker compose build
docker compose up -d

docker compose exec app \
  env ADMIN_USERNAME=admin ADMIN_PASSWORD='至少12位的密码' \
  pnpm db:seed-admin

curl -fsS http://127.0.0.1:3000/api/health
```

- 容器 entrypoint 启动前会自动执行 `pnpm db:migrate`，迁移可重复执行。
- `ports` 只绑定 `127.0.0.1:3000`；对外仍由宿主机 Nginx 终止 TLS 并反代到 3000，配置见第 3 节。
- 数据卷：`kirameku-data` → `/data`，其中 `db/` 放 SQLite，`uploads/` 放本地图片，`backups/` 放备份文件。
- 构建阶段用临时数据库执行 `pnpm db:migrate` 和 `pnpm build`；生产库迁移只发生在容器启动时。
- 镜像包含完整的 `pnpm start` 运行时和运维脚本，体积约 1.4 GB。Next 生产构建建议在本地或 CI 完成后再分发镜像，避免在内存很小的生产服务器上直接构建。

### 5.2 升级

```bash
git pull --ff-only
docker compose build
docker compose up -d
docker compose logs -f app
```

### 5.3 备份、恢复与维护命令

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

### 5.4 改用宿主机目录

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

## 6. 环境变量

完整清单见 `Kirameku/.env.example`。关键项：

| 变量 | 说明 |
|:---|:---|
| `DATABASE_PATH` | SQLite 文件路径；生产放持久卷 |
| `AUTH_SECRET` | 管理员 JWT 签名密钥，≥32 字符 |
| `SITE_READ_ONLY` | `1` 时拒绝公开写接口，适合迁移/维护窗口 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth 登录（访客评论/点赞） |
| `GITHUB_REDIRECT_URI` | 必须与 GitHub OAuth App 回调地址一致 |
| `FRONTEND_ORIGIN` | 同源校验使用；生产填正式 HTTPS 域名 |
| `UPLOAD_DIR` | 未配置 OSS 时的本地图片目录 |
| `OSS_*` | 配置完整后图片写入阿里云 OSS |
| `VISITOR_RETENTION_DAYS` | 访客 IP 记录保留天数，默认 90 |

数据库维护脚本不会自动加载 `.env.local`；用非默认路径时在命令前显式传 `DATABASE_PATH`。

## 7. 备份与恢复

```bash
# 在线备份（WAL 安全），并保留 integrity_check
DATABASE_PATH=/data/kirameku.db BACKUP_DIR=/data/backups pnpm db:backup --prune

# 恢复：先停应用
sudo systemctl stop kirameku
pnpm db:restore /data/backups/kirameku-....db --target /data/kirameku.db
sudo systemctl start kirameku
```

不要把 `kirameku.db`、`-wal`、`-shm` 直接复制到另一台机器当作备份；WAL 文件不一致会丢失最近写入。备份文件建议再同步到对象存储，并定期做一次恢复演练。

## 8. 常见问题

### Nginx 缓存导致页面引用旧 chunk / Mixed Content

旧架构曾出现 `http://boke.hiromu.top:8000/...` 的混合内容错误。现在已没有 8000 端口和 `/api` 反代；如果再次出现类似问题，按顺序检查：

1. 页面 HTML 是否被 Nginx/CDN 强缓存，仍引用旧构建的 chunk。
2. 环境变量或前端代码里是否残留 `http://`、`localhost:8000`、`127.0.0.1:8000`。
3. 发布后清理 Nginx 缓存；确认 `location /` 不缓存 HTML，`/_next/static/` 才长缓存。
4. 确认 `FRONTEND_ORIGIN`、`GITHUB_REDIRECT_URI` 使用正式 HTTPS 域名。

### SQLite 写入失败 / `database is locked`

- 确认只有一个 Node 实例写同一个 `DATABASE_PATH`。
- 不要把数据库文件放在 NFS、SMB 或跨容器共享卷上。
- 检查是否有外部脚本长时间持有事务；维护脚本应在低峰运行。
- 备份用 `pnpm db:backup`，不要在写入时 `cp`。

### 上传图片 404

- 未配置 OSS 时确认 `UPLOAD_DIR` 指向持久目录，且 Node 进程有读写权限。
- 如果用 Nginx `alias` 直出，确认 `/uploads/` 的 alias 路径和 `UPLOAD_DIR` 一致。
- 检查文件是否被部署脚本清掉；上传目录不能放在临时构建目录里。

### 后台登录失败

- `AUTH_SECRET` 是否 ≥32 字符，且发布前后保持一致；修改会让现有管理员会话失效。
- 管理员账号是否通过 `pnpm db:seed-admin` 创建；没有默认密码。
- 反向代理是否传递了正确的 `Host`、`X-Forwarded-Proto`，以及 `FRONTEND_ORIGIN` 是否匹配。

## 9. 旧架构清理记录

2026-10-22 已完成：

- 删除 `Kirameku-backend/`（FastAPI + Vue 后台 + `init_db.sql`）。
- 删除 `Kirameku/scripts/migrate/`（PostgreSQL 结构审计与一次性导入）。
- 移除 `postgres` devDependency 和 `migrate:audit` / `migrate:pg2sqlite` 脚本。
- 移除文档和注释中的旧后端部署指引；`README.md`、`AGENTS.md`、`server/db/README.md` 以当前单进程架构为准。

Git 历史仍保留旧代码和迁移脚本；如果未来需要查阅，只能从历史提交恢复，不要在生产重新引入第二套运行时。
