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
              ├── app/api/**         Route Handlers
              └── server/**          领域服务 + Drizzle + SQLite
```

- **一个部署单元**：前台、API、后台在同一个 Next.js 进程内，没有 `/api` 反向代理。
- **一个数据库**：单文件 SQLite（WAL 模式），备份即文件；只能运行一个实例。
- **一种语言**：应用代码、脚本和测试全部是 TypeScript。
- **小说模块已下线**：`/novel/*`、`/reader3/*` 不再提供，旧路径返回 404。

## 项目结构

```
.
├── Kirameku/                      # 单体应用
│   ├── app/
│   │   ├── (site)/                # 前台页面：首页/文章/说说/留言/相册/项目/友链/收藏/音乐/工具箱
│   │   ├── (admin)/admin/         # 管理后台（登录页 + 受保护布局）
│   │   ├── api/                   # 公开 API 与 /api/admin/* 管理 API
│   │   ├── feed/                  # RSS
│   │   └── uploads/               # 本地上传文件读取（OSS 未配置时）
│   ├── components/                # 前台组件 + components/admin 后台组件
│   ├── lib/                       # 客户端工具、Markdown 渲染
│   ├── server/
│   │   ├── db/                    # Drizzle schema、SQLite 连接、迁移
│   │   ├── auth/                  # 管理员 JWT、GitHub OAuth、鉴权守卫
│   │   ├── modules/               # 领域服务（posts/comments/visitors/...）
│   │   ├── http/                  # 统一错误、日志、限流、CSRF 校验
│   │   └── storage/               # 图片校验、OSS/本地存储
│   ├── content/about.md
│   ├── data/                      # SQLite 数据文件（gitignore）
│   └── scripts/                   # 迁移、备份/恢复、访客清理、计数校正
└── docs/                          # 重写方案与各阶段验证记录
```

## 功能模块

### 博客前台

| 模块 | 路径 | 描述 |
|:-----|:-----|:-----|
| 首页 | `/` | 文章预览、说说、照片墙，一站式入口 |
| 文章 | `/posts` | 分类筛选、标签、Markdown 渲染、服务端高亮、评论、点赞、浏览量 |
| 说说 | `/moments` | 碎片化记录，类朋友圈时间线 |
| 留言 | `/messages` | GitHub 登录后留言/回复 |
| 收藏夹 | `/bookmark` | 站点导航，分类管理，平台标签 |
| 项目 | `/projects` | 项目展示，数据来自 `project` 表 |
| 友链 | `/friends` | 漂流瓶主题，可拖动交互 |
| 照片墙 | `/photowall` | 相册瀑布流展示 |
| 归档 | `/timeline` | 时间河流可视化 |
| 音乐 | `/music` | 云音乐播放器 |
| 关于 | `/about` | 关于博主 |
| 工具箱 | `/garden/*` | 纯客户端小工具 |

### 管理后台（`/admin`）

仪表盘、文章、说说、项目、评论审核、留言审核、分类/标签、友链、收藏夹、相册、站点配置、访客、操作审计、账号（资料/改密），以及图片上传。

## 快速开始

要求 Node.js 22 与 pnpm 12：

```bash
cd Kirameku
pnpm install --frozen-lockfile

# 配置环境变量：至少填入 AUTH_SECRET（≥32 字符）
cp .env.example .env.local

# 建库（空库一键初始化）
pnpm db:migrate

# 创建管理员（不提供默认密码）
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

镜像由 GitHub Actions 构建并推送到 GHCR（`ghcr.io/<owner>/kirameku-lite`），服务器只拉取镜像，不编译代码。`docker-compose.yml` 只起应用：不发布宿主机端口，而是接入外部网络 `kirameku-edge`，以 `kirameku-app:3000` 暴露给已有的反代。

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

推送 `main` 后自动发布：`verify → 构建多架构镜像推送 GHCR → SSH 到服务器执行 scripts/deploy-server.sh`（备份数据库 → 拉镜像 → 重启 → 健康检查，不健康自动回滚）。发布会顺带装/刷新每日 systemd timer（`scripts/maintenance.sh`：备份 + 访客清理 + 计数校正）并给 app 容器配 100 MB × 3 的日志轮转；两者都能在 `.env` 里调，详见 [DEPLOY_NOTES.md](./DEPLOY_NOTES.md#63-定时维护systemd-timer)。

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
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | 代码检查 / 类型检查 / 单元与集成测试 |
| `pnpm db:migrate` | 执行版本化 SQLite 迁移 |
| `pnpm db:seed-admin` | 创建或重置管理员 |
| `pnpm db:backup` / `pnpm db:restore` | 在线备份（数据库 + uploads 归档） / 恢复（恢复前先停应用） |
| `bash scripts/maintenance.sh` | 每日维护：备份 + 访客清理 + 计数校正（部署时自动装 systemd timer） |
| `pnpm db:prune-visitors` | 按 `VISITOR_RETENTION_DAYS` 清理访客记录 |
| `pnpm db:reconcile-counts` | 校正分类/标签/说说/相册冗余计数 |

## 环境变量

本地开发使用 `Kirameku/.env.local`（完整清单见 `.env.example`）；Docker Compose 使用仓库根目录 `.env`（模板见 `compose.env.example`）。

```env
DATABASE_PATH=./data/kirameku.db
SITE_READ_ONLY=0
AUTH_SECRET=          # openssl rand -base64 48
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback

# 图片上传：配置完整 OSS_* 后写入 OSS，否则写入 UPLOAD_DIR
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET_NAME=
OSS_ENDPOINT=
OSS_CUSTOM_DOMAIN=
OSS_PREFIX=Boke/
UPLOAD_DIR=./uploads

VISITOR_RETENTION_DAYS=90
```

## 设计亮点

- **Glassmorphism 风格** — 全站毛玻璃质感，亮色暗色双主题
- **微交互动画** — Framer Motion 驱动，页面过渡、卡片悬停、果冻弹跳
- **服务端 Markdown** — 统一的 `unified` 管线，先清洗后高亮，前端不再加载 `marked`/`highlight.js`
- **浏览量去重** — 客户端按天上报，服务端再按 IP + 文章 + 日期去重，预取不会刷量
- **收藏夹** — 平台标签、搜索过滤
- **漂流瓶友链** — 可拖动的漂浮瓶子，点击查看详情
- **时间河流** — 归档页的可视化时间线，拖动交互
- **Live2D 看板娘** — 右下角可互动，连续点击 Logo 7 次触发彩蛋；新增/更新模型见 [`docs/Live2D-新增与更新.md`](docs/Live2D-新增与更新.md)
- **移动端适配** — 响应式布局，移动端导航菜单

## License

MIT
