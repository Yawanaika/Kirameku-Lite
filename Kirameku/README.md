# Kirameku

TypeScript + Next.js 16 单体应用。公开站点、管理后台和 API 共用同一个进程；数据库为 SQLite（WAL）。

## 本地启动

需要 **Node.js 22 LTS**（见 `.nvmrc`；CI 同样使用 22）。从其他 Node 大版本切换后，重新编译 SQLite 原生模块：

```bash
pnpm install
pnpm rebuild better-sqlite3
cp .env.example .env.local
# 编辑 .env.local，至少设置 AUTH_SECRET（32+ 字符）
pnpm db:migrate
ADMIN_USERNAME=admin ADMIN_PASSWORD='至少12位的强密码' pnpm db:seed-admin
pnpm dev
```

如果 Turbopack 开发缓存异常或登录页长时间停在 `Compiling /admin/login`：

```bash
pnpm dev:clean     # 删除 .next/dev 后重新启动
pnpm dev:webpack   # 备用：改用 webpack 开发服务器
```

- 公开站点：<http://localhost:3000>
- 后台登录：<http://localhost:3000/admin/login>
- 健康检查：<http://localhost:3000/api/health>

不提供默认管理员密码；`db:seed-admin` 对已存在的用户名会更新密码。

> `.env.local` 由 Next.js 运行时读取；`db:*` / `migrate:*` CLI 脚本只读取当前 shell 环境变量。若修改了 `DATABASE_PATH`，请在命令前显式传入。

## 目录

```text
app/
├── layout.tsx              # 根布局，仅 html/body
├── (site)/                 # 公开站点（导航、主题、背景、音乐、访客追踪）
├── (admin)/admin/          # 登录页 + 受保护的仪表盘
├── api/auth/               # 登录、登出、当前用户、改密
└── api/health/             # 健康检查
server/
├── auth/                   # JWT、Cookie、bcrypt、requireAdmin
├── db/                     # Drizzle schema、迁移、SQLite 连接
├── http/                   # 错误信封、requestId、日志、限流、同源校验
└── modules/                # 认证、仪表盘服务
scripts/
├── seed-admin.ts
├── db-migrate.ts
├── backup-db.ts / restore-db.ts
└── migrate/                # PostgreSQL → SQLite 导出/审计
```

## 预警通知

后台 `/admin/notifications` 提供站内预警推送：渠道配置、事件开关与阈值、手动推送、最近推送记录都在同一页。

- 渠道：Telegram Bot、邮件（SMTP，nodemailer）、Webhook（JSON POST，可选 HMAC-SHA256 签名）。渠道参数存在 `notification_channel` 表，bot token / SMTP 密码 / 签名密钥用 `AUTH_SECRET` 派生密钥做 AES-256-GCM 加密，接口只回显掩码。
- 事件：`backup.stale`、`disk.low`、`http.error_rate`、`http.not_found_burst`、`db.busy`、`site.health`、`content.pending`。每个事件可单独开关、选渠道、调阈值与冷却时间。
- 定时巡检：进程内调度器（`instrumentation.ts`）每 `NOTIFICATION_INTERVAL_MINUTES` 分钟跑一次检查；`NOTIFICATION_CHECKS=0` 可关闭，只保留手动推送。
- 外部推送：`POST /api/internal/notify`，需 `CRON_SECRET`（`Authorization: Bearer <secret>` 或 `x-kirameku-secret`），body 为 `{ eventKey, level, title, body, channels?, force?, fields?, link? }`，方便外部探针或自建巡检接入。
- 推送记录写入 `notification_log`，只保留最近 2000 条。

## 常用命令

| 命令 | 说明 |
|:---|:---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm dev:clean` | 清除 `.next/dev` 后启动 |
| `pnpm dev:webpack` | 使用 webpack 启动（Turbopack 异常时备用） |
| `pnpm typecheck` | TypeScript 检查 |
| `pnpm test` | Vitest 单测 |
| `pnpm build` | 生产构建 |
| `pnpm db:migrate` | 应用未执行的 SQLite 迁移 |
| `pnpm db:seed-admin` | 创建/更新管理员 |
| `pnpm db:backup` | 在线备份 + 完整性校验 |
| `pnpm db:restore <file>` | 恢复备份（先停应用） |

数据库默认路径 `./data/kirameku.db`，由 `DATABASE_PATH` 覆盖。备份与迁移说明见 [`server/db/README.md`](./server/db/README.md)，整体方案见 [`../docs/单体化重写方案.md`](../docs/单体化重写方案.md)。
