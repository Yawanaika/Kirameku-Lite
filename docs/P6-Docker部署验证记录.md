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
