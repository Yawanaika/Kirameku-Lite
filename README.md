<div align="center">

# Kirameku-Lite

**きらめく — 像星光一样闪烁**

一个单进程、单语言、单数据库的个人博客系统：Next.js 16 + React 19 + SQLite。

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

## 效果展示

<div align="center">
  <img src="docs/images/首页.png" width="90%" />
  <img src="docs/images/文章.png" width="90%" />
  <img src="docs/images/说说.png" width="90%" />
  <img src="docs/images/照片墙.png" width="90%" />
  <img src="docs/images/归档.png" width="90%" />
</div>

---

## 架构

```
Browser
  └── Caddy (443)                    独立 compose 项目，用 kirameku-edge 网络反代
        └── kirameku-app:3000        Next.js 16 (Node 22)，本项目容器
              ├── app/(site)/**      前台页面（RSC + 客户端岛屿）
              ├── app/(admin)/**     管理后台（/admin）
              ├── app/api/**         Route Handlers + /api/health、/api/internal/*
              └── server/**          领域服务 + Drizzle + SQLite
```

- **一个部署单元**：前台、API、后台在同一个 Next.js 进程内，没有 `/api` 反向代理。
- **一个数据库**：单文件 SQLite（WAL 模式），备份即文件；只能运行一个实例。
- **一种语言**：应用代码、脚本和测试全部是 TypeScript。
- **进程内预警巡检**：`/admin/notifications` 可配 Telegram / 邮件 / Webhook，按备份新鲜度、磁盘余量、接口错误率、404 占比、数据库锁等待、待审内容堆积触发提醒。
- **小说模块已下线**：`/novel/*`、`/reader3/*` 不再提供，旧路径返回 404。

## 项目结构

```
.
├── Kirameku/                      # 单体应用
│   ├── app/
│   │   ├── (site)/                # 前台：首页/文章/说说/留言/相册/项目/友链/收藏/音乐/工具箱/关于/归档
│   │   ├── (admin)/admin/         # 管理后台（登录页 + 受保护布局）
│   │   ├── api/                   # 公开 API 与 /api/admin/* 管理 API
│   │   ├── auth/callback/         # GitHub OAuth 回跳页
│   │   ├── feed/                  # RSS
│   │   ├── uploads/               # 本地上传文件读取（OSS 未配置时）
│   │   ├── sitemap.ts / robots.ts # 站点地图与 robots.txt
│   │   └── layout.tsx             # 站点级 metadata（标题、分享卡、canonical）
│   ├── components/                # 前台组件、components/admin 后台、home/widgets 首页小组件
│   ├── lib/                       # 客户端工具、Markdown 渲染、站点设置类型
│   ├── server/
│   │   ├── db/                    # Drizzle schema、SQLite 连接、迁移
│   │   ├── auth/                  # 管理员 JWT、GitHub OAuth、鉴权守卫
│   │   ├── modules/               # 领域服务：posts/chatters/comments/messages/notifications/site-settings/...
│   │   ├── http/                  # 统一错误、日志、限流、CSRF 校验、指标采集
│   │   └── storage/               # 图片校验、OSS/本地存储
│   ├── scripts/                   # 迁移、备份/恢复、访客清理、计数校正、管理员 seed、性能基线
│   ├── content/about.md
│   └── data/                      # SQLite 数据文件（gitignore）
├── scripts/                       # 部署与服务端运维：deploy-server.sh / maintenance.sh / probe-health.sh
├── ops/cloudflare-probe/          # 站外健康探针（Cloudflare Worker + D1）
├── docs/                          # 重写方案、各阶段验证记录、Live2D 文档
└── docker-compose*.yml            # 应用 / 自带 Caddy / 宿主机反代 / 本地构建
```

## 功能模块

### 博客前台

| 模块 | 路径 | 描述 |
|:-----|:-----|:-----|
| 首页 | `/` | 个人卡片、最新文章/说说轮播、照片墙预览、站点统计与舔狗日记小组件 |
| 文章 | `/posts` | 分类筛选、标签、Markdown 渲染、服务端高亮、评论、点赞、浏览量 |
| 说说 | `/moments` | 碎片化记录，图片、心情、点赞与评论，类朋友圈时间线 |
| 留言 | `/messages` | GitHub 登录后留言/回复 |
| 收藏夹 | `/bookmark` | 站点导航，分类管理，平台标签 |
| 项目 | `/projects` | 项目展示，数据来自 `project` 表 |
| 友链 | `/friends` | 漂流瓶主题，可拖动交互 |
| 照片墙 | `/photowall` | 相册瀑布流展示 |
| 归档 | `/timeline` | 时间河流可视化 |
| 音乐 | `/music` | 网易云歌单播放，直链解析失败时回落到公开 Meting 接口 |
| 关于 | `/about` | 关于博主 |
| 工具箱 | `/garden/*` | 纯客户端小工具（Markdown 编辑器、二维码、颜色、烟花、生命游戏、地图、数学、Python 等） |

### 管理后台（`/admin`）

仪表盘、文章、说说、项目、评论、留言、分类/标签、友链、收藏夹、相册、站点设置、导航菜单、站点配置、访客、预警通知、操作审计、账号（资料/改密），以及图片上传。

- **站点设置**：站点标题与公网地址、作者资料、主题渐变与背景图、分享卡、备案号、音乐歌单，保存后 metadata、sitemap、RSS 一起生效。
- **导航菜单**：顶部下拉菜单的图标、排序与链接。
- **站点配置**：键值对形式的零散前台配置，通过 `/api/site-config` 读取。
- **后台体验**：自带浅色模式与移动端抽屉导航。

## 快速开始

要求 Node.js 22（`engines` 允许 22–24）与 pnpm 12（CI 使用 12.8.1）：

```bash
cd Kirameku
pnpm install --frozen-lockfile

# 配置环境变量：至少填入 AUTH_SECRET（≥32 字符）
cp .env.example .env.local

# 建库（空库一键初始化）
pnpm db:migrate

# 创建管理员（不提供默认密码；命令行没给时回落读取 ADMIN_*）
ADMIN_PASSWORD='至少12位的密码' ADMIN_USERNAME=admin pnpm db:seed-admin

pnpm dev          # http://localhost:3000
                  # 后台 http://localhost:3000/admin
```

生产构建：

```bash
pnpm build
DATABASE_PATH=/data/kirameku.db pnpm start
```

### Docker Compose + 自动发布

镜像由 GitHub Actions 构建并推送到 GHCR（`ghcr.io/<owner>/kirameku-lite`），服务器只拉取镜像，不编译代码。`docker-compose.yml` 只起应用：不发布宿主机端口，而是接入外部网络 `kirameku-edge`，以 `kirameku-app:3000` 暴露给已有的反代。容器启动时默认先执行 `pnpm db:migrate`，可用 `RUN_MIGRATIONS=0` 关闭（一次性维护命令常用）。

数据落在宿主机的普通目录里（bind mount，不是命名卷），备份能与数据库分开存放：

| 宿主机（相对 compose 项目目录） | 容器内 |
|:---|:---|
| `./data/db/kirameku.db` | `/data/db/kirameku.db` |
| `./data/uploads/` | `/data/uploads` |
| `./backup/` | `/data/backups` |

路径可用 `.env` 的 `KIRAMEKU_DATA_DIR` / `KIRAMEKU_BACKUP_DIR` 改。这几个目录的属主必须是容器内的 `node`（UID 1000）：部署脚本每次发布会自动修正，手动首次启动时先 `mkdir -p data/db data/uploads backup && sudo chown -R 1000:1000 data backup`。

```bash
docker network create kirameku-edge   # 一次性；部署脚本也会自动建
cp compose.env.example .env      # 至少填写 AUTH_SECRET 和 FRONTEND_ORIGIN
docker compose pull
docker compose up -d
docker compose exec app \
  env ADMIN_USERNAME=admin ADMIN_PASSWORD='至少12位的密码' \
  pnpm db:seed-admin
```

推送 `main` 后自动发布：`verify → 构建多架构镜像推送 GHCR → SSH 到服务器执行 scripts/deploy-server.sh`（备份数据库 → 拉镜像 → 重启 → 健康检查，不健康自动回滚）。发布会顺带装/刷新两个 systemd timer，并给 app 容器配 100 MB × 3 的日志轮转；这三个开关都能在 `.env` 里调，详见 [DEPLOY_NOTES.md](./DEPLOY_NOTES.md#63-定时维护systemd-timer)。

- **每日维护**（`scripts/maintenance.sh`）：数据库备份 + uploads 归档、访客记录清理、冗余计数校正。
- **同机探针**（`scripts/probe-health.sh`）：每 5 分钟从宿主机请求公网 `/api/health`，连续失败后经 `/api/internal/notify` 发告警；进程挂了但机器还在时它仍能报。

进程内自检和同机探针都跑在这台机器上，整机宕机时都发不出去，所以另有 `ops/cloudflare-probe/` 的站外 Cloudflare Worker（D1 存状态）。

可观测入口：`/api/health` 返回数据库状态、最近迁移与运行时间，供 Docker healthcheck 和探针使用；`/api/internal/metrics`（需 `CRON_SECRET`）返回内存、事件循环延迟、备份新鲜度与磁盘余量；`/api/internal/notify` 供探针投递告警。

反代怎么接：

- Caddy 在另一个 compose 项目里（常见）：让它加入 `kirameku-edge` 网络并 `reverse_proxy kirameku-app:3000`，本项目无需任何改动。
- 本项目自带 Caddy（服务器上没有别的反代）：`docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d`
- 反代装在宿主机上（systemd Caddy / Nginx）：`docker compose -f docker-compose.yml -f docker-compose.host-proxy.yml up -d app`
- 想在本机构建而不是拉镜像：`docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`

完整的服务器初始化、仓库 Secrets/Variables 配置和回滚步骤见 [DEPLOY_NOTES.md](./DEPLOY_NOTES.md#2-服务器一次性初始化)。

## 常用脚本

| 命令 | 作用 |
|:-----|:-----|
| `pnpm dev` / `pnpm build` / `pnpm start` | 开发 / 构建 / 启动 |
| `pnpm dev:clean` / `pnpm dev:webpack` | 清 `.next/dev` 缓存后启动 / 用 webpack 启动 |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | 代码检查 / 类型检查 / 单元与集成测试 |
| `pnpm db:migrate` | 执行版本化 SQLite 迁移 |
| `pnpm db:seed-admin` | 创建或重置管理员 |
| `pnpm db:backup` / `pnpm db:restore` | 在线备份（数据库 + uploads 归档） / 恢复（恢复前先停应用） |
| `pnpm db:prune-visitors` | 按 `VISITOR_RETENTION_DAYS` 清理访客记录 |
| `pnpm db:reconcile-counts` | 校正分类/标签/说说/相册冗余计数 |
| `pnpm db:generate` | 生成 Drizzle 迁移（当前初始迁移是手写的，需要先有基线快照） |
| `pnpm perf:baseline` | 对运行中的生产构建做无依赖的压测/冒烟基线 |
| `bash scripts/maintenance.sh` | 每日维护：备份 + uploads 归档 + 访客清理 + 计数校正（部署时自动装 systemd timer） |
| `bash scripts/probe-health.sh` | 同机健康探针；`--dry-run` 只报告不通知 |
| `bash scripts/deploy-server.sh` | 服务器端发布：备份 → 拉镜像 → 重启 → 健康检查 → 失败回滚 |

## 环境变量

本地开发使用 `Kirameku/.env.local`（模板 [`Kirameku/.env.example`](./Kirameku/.env.example)）；Docker Compose 使用仓库根目录 `.env`（模板 [`compose.env.example`](./compose.env.example)）。两份模板的变量名、区块顺序与默认值保持一致，只有少量变量分属两个场景（Compose 侧多 `SHARED_NETWORK` / `SITE_DOMAIN` / `KIRAMEKU_*` / `MAINTENANCE_*` / `PROBE_*` / `PULL_GIT`，裸机侧多本地路径）。关键变量：

```env
# --- 路径与站点 ---
DATABASE_PATH=./data/kirameku.db
UPLOAD_DIR=./uploads
BACKUP_DIR=./backups
FRONTEND_ORIGIN=http://localhost:3000
# 站点对外 URL：sitemap、RSS、canonical、分享卡都拿它拼绝对地址；默认回退到 FRONTEND_ORIGIN
# SITE_URL=https://boke.hiromu.top
SITE_READ_ONLY=0

# --- 认证与内部接口 ---
AUTH_SECRET=          # openssl rand -base64 48，至少 32 字符
CRON_SECRET=          # 可选：保护 /api/internal/*；未设置时这些接口返回 404
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
# GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback

# --- 分享卡片（可选，留空回退 siteConfig） ---
# SITE_SHARE_TITLE=
# SITE_SHARE_DESCRIPTION=
# SITE_SHARE_IMAGE=/images/hong.jpg
# SITE_SHARE_CARD=summary_large_image
# SITE_CONTACT_EMAIL=

# --- 图片上传：四项 OSS_* 配齐后写入 OSS，否则写入 UPLOAD_DIR ---
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET_NAME=
# OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
OSS_CUSTOM_DOMAIN=
# OSS_PREFIX=Boke/

# --- 隐私、维护与预警 ---
VISITOR_RETENTION_DAYS=90
NOTIFICATION_CHECKS=1              # 0/false 关闭进程内巡检
NOTIFICATION_INTERVAL_MINUTES=5    # 1-1440
```

`pnpm db:seed-admin` 优先读命令行参数；没给时回落读取 `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NICKNAME`（只读这三项，不会加载整个 `.env.local`，非默认 `DATABASE_PATH` 仍要在命令环境里显式传）。

## 设计亮点

- **Glassmorphism 风格** — 全站毛玻璃质感，亮色暗色双主题
- **微交互动画** — Framer Motion 驱动，页面过渡、卡片悬停、果冻弹跳
- **服务端 Markdown** — 文章/说说正文统一走 `unified` 管线，先清洗后高亮；只有工具箱里的 Markdown 编辑器在客户端用 `marked` 做即时预览
- **站点设置可视化** — 标题、公网地址、作者资料、主题渐变与背景图、分享卡、备案、音乐歌单都在后台改，保存后全局 metadata、sitemap、RSS 一起生效
- **导航可配置** — 顶部下拉菜单在 `/admin/navigation` 维护，带图标与排序
- **预警通知** — 备份过期、磁盘不足、错误率/404 激增、数据库锁等待、待审堆积；支持 Telegram / 邮件 / Webhook，站内自检、同机探针、站外 Worker 三层覆盖
- **浏览量去重** — 客户端按天上报，服务端再按 IP + 文章 + 日期去重，预取不会刷量
- **收藏夹** — 平台标签、搜索过滤
- **漂流瓶友链** — 可拖动的漂浮瓶子，点击查看详情
- **时间河流** — 归档页的可视化时间线，拖动交互
- **音乐多级兜底** — 直连解析失败时回落到公开 Meting 接口，且只缓存可播的地址
- **Live2D 看板娘** — 右下角可互动，连续点击 Logo 7 次触发彩蛋；新增/更新模型见 [`docs/Live2D-新增与更新.md`](docs/Live2D-新增与更新.md)
- **移动端适配** — 响应式布局，移动端导航菜单，后台同样支持抽屉式导航

## License

MIT
