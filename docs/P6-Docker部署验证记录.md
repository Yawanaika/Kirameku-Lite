# P6 Docker Compose 部署验证记录

日期：2026-10-22

环境：macOS arm64 + OrbStack，Docker 29.x，Docker Compose v5.1.2，Node 22.23.4 / pnpm 12.8.1。

## 1. 镜像构建

```bash
docker build --progress=plain -t kirameku:ci ./Kirameku
```

结果：成功。镜像为多阶段构建：`node:22-bookworm-slim` + pnpm 12.8.1；构建阶段安装 `python3 make g++` 以兼容原生模块，运行阶段只保留生产依赖并以 `node` 用户运行。镜像大小约 1.4 GB（包含 `next start` 运行时、生产依赖和 224 MB `public/` 资源）。

构建阶段使用临时 SQLite（`/tmp/kirameku-build.db`）和占位 `AUTH_SECRET`；生产库迁移由容器 entrypoint 在启动时执行。

## 2. 单容器 smoke

使用 `kirameku-data` 临时卷启动：

```bash
docker run -d --name kirameku-smoke \
  -p 127.0.0.1:3124:3000 \
  -v kirameku-smoke-data:/data \
  -e AUTH_SECRET=... \
  -e FRONTEND_ORIGIN=http://127.0.0.1:3124 \
  kirameku:ci
```

结果：

- entrypoint 自动执行迁移，依次应用 `0000_initial.sql`、`0001_seed_projects.sql`、`0002_admin_audit_indexes.sql`。
- `GET /api/health` 返回 `{"ok":true,"db":"ok","migration":"0002_admin_audit_indexes.sql","auth":"ok"}`。
- `/`、`/posts`、`/admin/login` 均返回 200。
- `pnpm db:seed-admin` 成功创建管理员。
- `pnpm db:backup` 成功写入 `/data/backups`，`integrity_check: ok`，`foreign_key_check: 0 violation(s)`。
- `/data`、`/data/db`、`/data/uploads`、`/data/backups` 属主均为容器内 `node` 用户（UID 1000）。

## 3. Compose smoke

```bash
cp compose.env.example .env   # 临时填入 AUTH_SECRET 与 FRONTEND_ORIGIN
docker compose -p kirameku-smoke up -d --build
```

结果：

- Compose 健康检查通过，`/api/health` 返回迁移版本 `0002_admin_audit_indexes.sql`。
- `/`、`/posts`、`/admin/login` 均返回 200。
- `kirameku-smoke_kirameku-data` 卷中生成 `db/`、`uploads/`、`backups/`，SQLite 文件位于 `/data/db/kirameku.db`。
- `docker compose exec app pnpm db:seed-admin` 与 `pnpm db:backup` 均成功。
- `docker compose down -v` 可清理临时容器和卷。

## 4. 验证中发现并修复的问题

1. `.dockerignore` 最初排除了整个 `data/`，导致 `@/data/posts`、`@/data/chatters` 在镜像构建时缺失；现在只排除 `data/*.db` 和 `data/*.db-*`。
2. Compose 会把未填写的可选变量传成空字符串；`GITHUB_REDIRECT_URI=""` 触发 `z.string().url()` 校验失败。`server/env.ts` 改为复用 `optionalUrl`，把空白值当作未设置。
3. 运行阶段最初没有默认 `DATABASE_PATH` / `UPLOAD_DIR` / `BACKUP_DIR`，直接 `docker run` 时会写入容器内的 `/app/data`；Dockerfile 现在默认指向 `/data/db`、`/data/uploads`、`/data/backups`。
4. `/app` 顶层目录最初仍归 root 所有；运行阶段补充 `chown node:node /app`，避免维护脚本在 `/app` 下创建文件时权限不足。

## 5. 未覆盖

- 未在 x86_64 Linux 上实际构建；CI 的 `docker` job 会在 `ubuntu-latest` 上执行 `docker build`。
- 未连接真实 GitHub OAuth、OSS bucket 或生产 Nginx；这些仍按 `DEPLOY_NOTES.md` 的环境变量和 Nginx 配置执行。
- 本次只验证单实例部署；SQLite 仍要求同一数据库只能有一个写入实例。

---

# 追加：Caddy 反代 + GHCR 自动部署验证（2026-10-22 晚）

环境同上（macOS arm64 + OrbStack，Docker 29.4.0，Compose v5.1.2）。这一轮把「CI 构建镜像 → GHCR → 服务器拉取」整条链路在真机 docker 上跑通，重点验证 `scripts/deploy-server.sh` 的失败回滚。

## 6. 镜像构建（两个架构分别验证）

```bash
docker build --platform linux/arm64 -t kirameku:local -f Kirameku/Dockerfile Kirameku   # 原生架构
docker buildx build --platform linux/amd64 -t kirameku:amd64-test -f Kirameku/Dockerfile Kirameku --load
```

两者都成功，说明 Dockerfile 不含架构相关步骤（`better-sqlite3` / `sharp` 都在构建阶段按目标架构编译）。镜像 1.4 GB。

> 本机 `linux/amd64,linux/arm64` 的多平台 `--push` 构建**没有**跑通：OrbStack 默认的 `docker` driver 报 `Multi-platform build is not supported for the docker driver`，而 `docker buildx create --driver docker-container` 在本机 bootstrap 时卡在拉取 `moby/buildkit`（当时 Docker Hub 返回 `EOF`）。CI 里由 `docker/setup-buildx-action` 提供 container driver，不受影响；这一点属于**本机环境限制，不是配置缺陷**。

## 7. Caddy + Compose 全栈

用本地 registry（`registry:2`）模拟 GHCR，把镜像推成 `localhost:5000/kirameku:v1`。

```bash
docker compose --env-file .tmp/compose-test.env -f docker-compose.yml -f docker-compose.build.yml -p kirameku-smoke up -d
```

结果：

- `app` 容器 `healthy`，`caddy` 在 `app` 健康后才启动（`depends_on: condition: service_healthy` 生效）。
- `app` **没有**发布宿主机端口，`docker compose ps` 显示 `3000/tcp`；80/443/443-udp 只由 caddy 占用。
- `http://localhost/` → `308` 跳 `https://localhost/`。
- `https://localhost/` → 200，TTFB 80 ms；`https://localhost/api/health` 返回 `{"ok":true,"db":"ok","migration":"0002_admin_audit_indexes.sql"}`。
- 证书由 Caddy 内部 CA 签发（`CN=Caddy Local Authority - ECC Intermediate`），有效期 12 小时；生产用真实域名时走 Let's Encrypt。
- `Accept-Encoding: zstd` 请求返回 `content-encoding: zstd`，`encode zstd gzip` 生效。
- 请求体上限：13 MB POST 到 `/api/auth/login` 返回 **413**（Caddy 拦截）；5 MB 正常放行到应用。
- 数据卷持久化：`docker compose up -d --force-recreate app` 后 `db_size_bytes`、迁移版本不变。

## 8. 部署脚本四条路径（真实 docker）

`scripts/deploy-server.sh` 全部四条路径都已验证：

| 场景 | 结果 |
|:--|:--|
| 首次部署（无旧容器） | pull → up → healthy → `exit 0` |
| 正常升级 v1 → v2 | 重新拉取 v2 → 重建 → healthy → `exit 0`，容器镜像变为 v2 |
| 新镜像无 HEALTHCHECK，`compose up` 失败 | 捕获失败 → 回滚到旧镜像 ID → healthy → `exit 1` |
| 新镜像有 HEALTHCHECK 但始终 unhealthy（`SERVICES=app` 走 `wait_healthy`） | 检测到 `unhealthy` → 回滚 → healthy → `exit 1` |

另外验证：

- GHCR 登录失败（假 token）时脚本立即以非 0 退出，并且 `trap cleanup` 删掉了临时 `DOCKER_CONFIG` 目录（`ls $TMPDIR/tmp.*` 数量不变）。
- 回滚后站点仍可访问：`https://localhost/` 200、`/api/health` 正常。
- `SITE_READ_ONLY=1` 重建容器后，`POST /api/visitors/record` 返回 503，`GET /` 仍 200。
- `docker-compose.host-proxy.yml` 覆盖后，`app` 只绑到 `127.0.0.1:3000`（`docker port` 确认），可用于宿主机已有 Caddy/Nginx 的场景。
- `actionlint`（`rhysd/actionlint` 容器）对三份 workflow 检出 0 问题。

## 9. 本轮发现并修复的问题

前一轮用 docker mock 测试时这些问题全部漏过，说明**脚手架级 mock 无法替代真实 daemon**。

1. **`set -e` 会让脚本跳过回滚**（严重）。`compose up -d` 在 `depends_on` 健康门不满足时会返回非 0，原脚本在 `set -euo pipefail` 下会立刻退出，根本执行不到下面的 rollback 段，服务器被留在坏镜像上。修复：`pull` 与 `up` 都用 `if ! ...` 捕获，记入 `DEPLOY_FAILED`，再统一进入回滚分支。
2. **回滚拉不到镜像**（严重）。`docker-compose.yml` 为自动升级设了 `pull_policy: always`，回滚时 `KIRAMEKU_IMAGE=sha256:...` 会让 compose 把裸镜像 ID 当 tag 去 registry 拉取，必然 `EOF` 失败。修复：回滚的 `compose up` 加 `--pull never`，并补 `--force-recreate`。
3. **Caddy 重复发 `Cache-Control`**。原 Caddyfile 用 `header @immutable Cache-Control ...` 给 `/_next/static/*` 加长缓存，但 Next.js 自己已经发了完全相同的头，结果每个静态资源都有两条 `cache-control`。修复：删掉 Caddy 这条规则，只保留 `request_body` 与 `reverse_proxy`，注释说明为什么不在这里改缓存头。
4. **单文件 bind mount 的 inode 问题**（不是 bug，但要写进文档）。编辑 `Caddyfile` 后宿主机换了 inode，容器内 `/etc/caddy/Caddyfile` 消失，`caddy reload` 报 `no such file or directory`；`docker compose up -d` 不会因此重建 caddy。处理办法是 `docker compose up -d --force-recreate caddy`。已写进 `DEPLOY_NOTES.md` §9。

## 10. 仍未覆盖

- **没有连接真实 GHCR**：推送/拉取用本地 `registry:2` 模拟。真实场景还需确认包可见性（公开/私有）与 `GITHUB_TOKEN` 的 `packages:write` 权限。
- **没有真实 SSH 跳板**：`release.yml` 的 deploy job 用 `ssh -o BatchMode=yes` 执行，本机只验证了脚本本体；SSH 私钥、`known_hosts`、`DEPLOY_*` Secrets 需在仓库里配好后实跑一次。
- **没有真实域名与 Let's Encrypt**：证书用的是 Caddy 内部 CA。首次真实签发依赖 80/443 可从公网访问且域名已解析。
- 多架构 `--push` 受本机 driver 限制未验证（见 §6）。
