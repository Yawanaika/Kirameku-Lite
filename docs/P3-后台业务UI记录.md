# P3 后台业务 UI 记录

日期：2026-10-21

## 本轮范围

后台从「登录 + 仪表盘空壳」推进到 14 个业务模块全部有管理入口（含后续新增的操作审计；图片上传控件除外）：

| 页面 | 功能 |
|:---|:---|
| `/admin` | 仪表盘；最近文章可跳转编辑，增加新建文章入口 |
| `/admin/posts` | 全状态文章列表、状态/分类/标签筛选、分页、发布/转草稿、删除 |
| `/admin/posts/new` | 新建文章：标题、slug、摘要、Markdown 正文、封面、分类、标签、状态、置顶 |
| `/admin/posts/[id]` | 编辑/删除文章，自动计算字符数和预计阅读时间 |
| `/admin/chatters` | 全状态说说列表、状态筛选、分页、发布/转草稿、删除 |
| `/admin/chatters/new` | 新建说说：正文、心情、图片地址、状态 |
| `/admin/chatters/[id]` | 编辑/删除说说 |
| `/admin/comments` | 文章评论/说说评论双 Tab，按状态筛选，通过/驳回/删除，递归回复展示 |
| `/admin/messages` | 留言审核、状态筛选、分页、通过/驳回/删除，递归回复展示 |
| `/admin/projects` | 项目列表、推荐切换、删除 |
| `/admin/projects/new` | 新建项目：名称、slug、简介、详细介绍、封面、技术栈、链接、状态、排序、推荐 |
| `/admin/projects/[id]` | 编辑/删除项目 |
| `/admin/taxonomy` | 分类/标签双栏 CRUD；分类删除后文章置空，标签删除级联关联 |
| `/admin/friend-links` | 友链 CRUD、审核/取消审核、排序 |
| `/admin/bookmarks` | 收藏分类和站点 CRUD、分类筛选、平台标签 |
| `/admin/albums` | 相册 CRUD、封面地址、照片数量展示 |
| `/admin/albums/[id]` | 相册元数据编辑、照片 URL 添加/删除、方向/说明/排序 |
| `/admin/site-config` | 站点配置 key/value CRUD、JSON 格式化、搜索 |
| `/admin/visitors` | 访客记录分页、归属地/设备信息展示、单条删除、清空 |
| `/admin/audit` | 后台写操作审计：操作人、动作、资源、请求路径、IP、时间；只读分页 |

侧边栏已改为真实路由导航，并根据当前路径高亮；13 个业务入口全部可点击（操作审计为后续新增）。

## 实现方式

- 后台页面沿用 `app/(admin)/admin/(protected)` 布局，服务端 `getAdminSession()` 统一鉴权；未登录访问业务页会 307 到 `/admin/login`。
- 列表和表单通过浏览器 `fetch` 调用现有 `/api/admin/*`，携带管理员 Cookie；写操作由浏览器自动带 `Origin`，服务端继续执行 `assertWritable()`、`assertSameOrigin()` 和 `requireAdmin()`。
- `components/admin/admin-api.ts` 统一处理 JSON 请求、错误消息和 422 字段错误；401 时跳转登录页。
- `components/admin/use-admin-data.ts` 统一处理列表加载、错误、刷新和 AbortController 取消请求；加载状态与请求 path/version 绑定，避免 effect 内同步 setState。
- `components/admin/AdminNav.tsx` 使用 `usePathname()` 高亮当前模块。
- 新增 `lib/utils.ts` 和 `components/ui/*`：`Button`、`Input`、`Textarea`、`Select`、`Label`、`Badge`、`Card`、`Table`。组件按 shadcn 的 `cn` + CVA 结构组织；表单仍使用原生控件，Radix Dialog 已在 P5.3 引入用于确认框。
- 删除操作原使用浏览器确认框，P5.3 已替换为 Radix Dialog；文章/说说/评论/留言/项目/相册/收藏分类的删除语义与后台 API 一致，评论/留言删除会级联回复，相册删除会级联照片，收藏分类删除会级联站点。
- 文章编辑器当前使用 Markdown 文本域，暂未接入 CodeMirror；字数按正文 `length` 实时计算，阅读时间为 `max(1, floor(wordCount / 300))`。
- 相册详情新增 `GET /api/admin/albums/[id]` 返回 `{ album, photos }`；访客新增 `GET /api/admin/visitors/count` 返回总数。两者都要求管理员会话。

## 验证

```text
Node 22 / pnpm 12.8.1
pnpm typecheck          通过
pnpm test               19 个文件，100 个测试通过
pnpm build              通过（19 个后台页面路由，总静态页面仍为 44）
ESLint                  新增/修改文件通过
admin UI smoke          临时 SQLite + 管理员 JWT：
                        /admin、/admin/posts、/admin/posts/new、/admin/chatters、
                        /admin/comments、/admin/messages、/admin/projects、
                        /admin/taxonomy、/admin/friend-links、/admin/bookmarks、
                        /admin/albums、/admin/albums/1、/admin/site-config、
                        /admin/visitors 均 200；
                        未登录 /admin/posts、/admin/albums 返回 307
API smoke                categories/tags/friend-links/bookmarks/albums/photos/
                         site-config 创建成功；album detail、visitors count 返回正确
```

## 后续

1. ~~图片上传迁移到本地/对象存储，随后把相册照片 URL 输入替换为上传控件。~~ 已在 P3.1 完成。
2. ~~引入 Radix Dialog/Select、TanStack Table 或 react-hook-form（按实际复杂度决定），替换浏览器确认框和手写表格状态。~~ 已在 P5.3 引入 Radix Dialog、替换全部 19 处 `window.confirm`；TanStack Table / react-hook-form 未引入，现有手写表格状态规模可控。
3. ~~文章编辑器接入 CodeMirror 和 Markdown 预览。~~ 已在 P5.2 完成。
4. 后台移动端导航已完成（P5.2）；操作审计日志已完成（P3.3）；更细的权限控制仍开放。
5. ~~为新增的 `GET /api/admin/albums/[id]`、`GET /api/admin/visitors/count` 补充路由级测试。~~ 已在 P5.2 完成。
6. 按 P3.2 的评估结果完成旧后端下线。

## P3.1 图片上传（2026-10-22）

图片上传已从旧 FastAPI 迁到 Next Route Handler，不再依赖 `127.0.0.1:8000`：

- 新增 `POST /api/admin/upload/image`：要求管理员会话、同源、非只读模式，并按管理员限流 20 次/小时。
- 新增兼容别名 `POST /api/upload/image`，保留一个版本，新代码只使用管理路径。
- `server/storage/image.ts` 用魔数识别 JPG/PNG/WebP/GIF，拒绝 SVG、伪造 Content-Type、空文件、截断文件和超过 10MB 的文件，并从容器头读取宽高与横竖方向。
- `server/storage/index.ts` 优先写入 OSS（配置完整的 `OSS_*` 时使用签名 PUT），否则写入 `UPLOAD_DIR`（默认 `./uploads`）。
- 新增 `GET /uploads/[...path]` 读取本地上传文件，带路径穿越防护、`nosniff` 和长期缓存；生产仍建议由 Nginx alias 直接提供。
- 后台 `ImageUploader` 支持上传、URL 回填和预览，已接入文章封面、项目封面、相册封面与相册照片；相册照片上传后自动回填方向。
- `.env.example` 增加 `OSS_*` / `UPLOAD_DIR`，删除过渡期的 `NEXT_PUBLIC_API_URL`。

本轮没有引入 `sharp` / `ali-oss` 依赖：尺寸与格式校验由 `server/storage/image.ts` 内置完成，OSS 使用原生 `fetch` + HMAC-SHA1 签名。后续如需 EXIF 纠正或转码，可保持 `storeImageFile()` 接口不变，替换图片解析实现。

新增测试：`server/storage/image.test.ts`、`server/storage/local.test.ts`、`server/storage/oss.test.ts`。已运行 `pnpm exec vitest run server/storage/image.test.ts server/storage/local.test.ts server/storage/oss.test.ts`，3 个文件 / 14 个测试全部通过；按约定未运行 `build` 或开发服务器。

## P3.2 旧后端下线评估（2026-10-22）

结论：评估时 `Kirameku/` 运行时已经不依赖 `Kirameku-backend/`，但当时不建议直接删除；先完成代理清理、全站 smoke 和生产切流确认。2026-10-22 用户确认三项下线条件已满足，目录已删除，见 P3.4。

已确认：

- `siteConfig.apiBaseUrl` 为 `""`，前端请求全部走同源 `/api/*`。
- 文章、评论、留言、相册、项目、收藏夹、友链、站点配置、访客、认证等接口均有本地 Route Handler。
- `/api/music`、`/api/uapis` 已是 Next 本地反代外部服务，不再经过 FastAPI。
- 图片上传已迁到 `/api/admin/upload/image`，本地文件由 `/uploads/[...path]` 提供。
- `Kirameku-backend/uploads/` 不存在，没有本地图片文件需要先迁移。

删除前必须处理：

1. [x] 删除 `Kirameku/next.config.mjs` 中的两条 fallback rewrite（`/api/:path*`、`/uploads/:path*` → `127.0.0.1:8000`），并确认未命中的路径返回预期 404，而不是误代理。已在 P5.1 完成。
2. [x] 跑一次全站 smoke：公开页面/API、后台登录与 CRUD、图片上传、RSS、sitemap、`/api/health`。已在 P5.1 完成。
3. [x] 确认生产已切到 SQLite，PostgreSQL 备份可恢复，且已经超过 `T+7` 回滚窗口。2026-10-22 用户确认。
4. [x] 删除 `Kirameku-backend/`，同步更新 `README.md`、`AGENTS.md`、`DEPLOY_NOTES.md` 和迁移文档中的旧后端描述。2026-10-22 已执行，见 P3.4。
5. [x] 若确认不再需要 PostgreSQL → SQLite 迁移，再清理 `postgres` devDependency、`init_db.sql` 引用和迁移脚本说明；否则先保留迁移脚本。2026-10-22 已清理。

注意：源码可以从 Git 历史恢复，但生产 PostgreSQL 数据、旧环境变量、旧 Nginx 配置和回滚窗口不能仅靠仓库历史恢复。本次删除前已完成用户确认和 SQLite 备份核对；Git 历史仅作为源码参考，不作为生产数据备份。

## P5.1 收尾进展（2026-10-22）

- 删除前检查 1、2 已完成：`next.config.mjs` 的 `/api/*`、`/uploads/*` fallback rewrites 已移除，未命中路径返回 404；临时 SQLite + 管理员会话的全站 smoke 通过（公开页、后台 14 页、CRUD、上传、RSS/sitemap、限流、浏览量去重）。
- P3.1 记录中写的 `GET /uploads/[...path]` 当时实际并未落库，导致本地上传写入成功但读取 404；P5.1 已补齐并通过 smoke。
- 新增 `/admin/account`（资料/改密），补齐后台最后一项账号入口。
- 删除前检查 3、4、5 已于 2026-10-22 由用户确认满足，`Kirameku-backend/` 和 PostgreSQL 迁移脚本已删除，见 P3.4。
- 后续项 4 的操作审计已完成（P3.3）；更细粒度权限控制仍开放；CodeMirror 编辑器、Markdown 预览、后台移动端导航已在 P5.2 完成，Radix 确认框已在 P5.3 完成。

## P5.2 后台编辑体验（2026-10-22）

- 文章编辑器正文从 `<Textarea>` 换成 CodeMirror 6（复用仓库已有的 `codemirror` / `@codemirror/lang-markdown` / `@codemirror/theme-one-dark`）。`components/admin/MarkdownEditor.tsx` 封装受控编辑器：视图只创建一次，外部加载文章时通过 dispatch 同步内容，不重建编辑器。
- 新增编辑/分栏/预览三种视图；预览通过 `POST /api/admin/markdown/preview` 走服务端 `lib/markdown.ts`，与前台文章页使用同一套 `remark → rehype-sanitize → rehype-highlight` 管线，输入上限 200,000 字符。客户端不引入第二套 Markdown 渲染器；注入预览的 HTML 只来自服务端清洗结果，与前台文章页的渲染方式一致。
- 预览请求 400ms 防抖并可中止，避免快速输入时堆积请求；管理员会话 + 同源检查。
- 后台移动端导航：`AdminShell` 侧栏在 `lg` 以下隐藏，新增 `AdminMobileNav` 抽屉（Escape/遮罩关闭、路由切换自动收起、焦点还原、Tab 焦点环、锁定滚动、桌面断点自动关闭）；桌面侧栏改为 sticky 独立滚动。
- 同轮补齐 `GET /api/admin/albums/[id]`、`GET /api/admin/visitors/count` 与 Markdown 预览的路由级测试（见 P5 记录第 10 节）。
- 验证：`/admin` SSR 含移动导航入口，`/admin/posts/new` SSR 含视图切换；未登录预览 401、管理员预览 200 且 `<script>` 被清除、代码块带 `hljs-*`、超长正文 422；27 个测试文件 / 145 个测试通过，生产 build 44 个静态页面。

## P5.3 确认框迁移到 Radix Dialog（2026-10-22）

- 新增 `@radix-ui/react-dialog` 1.3.1 及 `components/ui/dialog.tsx`（Portal、Overlay、Content、Title、Description）。
- 新增 `components/admin/ConfirmProvider.tsx`：`useConfirm()` 返回 `Promise<boolean>`，替代 `window.confirm`；`AdminShell` 用 Provider 包裹所有后台页面。
- 替换 15 个后台组件中的 19 处浏览器确认框；删除/清空操作的文案和级联语义保持不变，确认按钮使用 destructive 样式。
- 可访问性由 Radix 提供：焦点陷阱、Escape/遮罩关闭、`role="dialog"` 与 aria 关联；同时只允许一个确认框，重复请求会先取消前一个。
- 验证：14 个后台页面（含所有使用确认框的管理页）SSR 均 200；客户端 bundle 中已无 `window.confirm`；typecheck、27 个测试文件 / 145 个测试、生产 build 44 个静态页面通过。

详见 [`docs/P5-加固验证记录.md`](./P5-加固验证记录.md)。

## P3.3 后台操作审计（2026-10-22）

后台写操作现在会自动落审计日志，不需要在每个 Route Handler 里手写记录：

- `server/http/audit-context.ts` 用 Node `AsyncLocalStorage` 建立请求级上下文；`handle()` 在调用业务函数前创建上下文，`requireAdmin()` 验证成功后把当前管理员写入上下文。
- `handle()` 在响应为 2xx 后调用 `server/http/audit.ts` 的 `recordAdminRequestAudit()`，只记录 `/api/admin/*` 的 `POST`/`PUT`/`PATCH`/`DELETE`；`GET`、失败响应和只读的 `/api/admin/markdown/preview` 不记录。
- 动作由方法和路径推导：`create`、`update`、`delete`、`status`（`*/status`）、`upload`（上传）、`clear`（清空访客）、`update`（站点配置 upsert）；资源类型取路径第一段（如 `posts`、`albums`、`site-config`），目标 ID 优先取路径数字，其次取响应体的 `id`。
- `detail` 保存 `{ method, path, status }`，`ip` 复用 `getClientIp()`；写日志失败只记录错误日志，不影响已经成功的业务响应。
- 新增 `server/modules/audit/`（contracts/service/index）：`record()` 写入 `admin_audit_log`，`list()` 按时间倒序分页，左连接 `user` 显示操作人，支持 `action` / `targetType` 过滤，解析 `detail` 并容忍历史坏 JSON。
- 新增 `GET /api/admin/audit`：要求管理员会话，查询参数 `page`、`size`（默认 30，最大 100）、`action`、`targetType`，返回 `{ items, total }`。
- 新增 `/admin/audit` 页面和侧边栏/移动端导航入口；表格展示时间、操作人、动作、资源、请求路径和 IP，只读，不提供删除按钮（审计日志不应由后台随手修改）。
- 新增迁移 `0002_admin_audit_indexes.sql`，为 `created_at`、`actor_id`、`action`、`target_type` 补索引。`admin_audit_log` 表在最初的 `0000_initial.sql` 中已经存在。
- 自动审计覆盖所有现有后台写接口，包括文章/说说/项目/评论/留言/分类/标签/友链/收藏夹/相册/照片/站点配置/访客/账号/图片上传；新增后台写接口时只要继续使用 `handle()` + `requireAdmin()` 就会自动纳入。

边界说明：

- 审计记录的是“成功写操作”，不记录登录失败、401 和校验失败；这些仍由请求日志/限流日志覆盖。
- `getClientIp()` 信任反向代理传入的 `X-Forwarded-For` / `X-Real-IP`，只用于展示，不作为安全边界。
- 当前没有审计日志保留期/归档任务，也没有更细粒度的角色权限；所有管理员仍是同一权限级别。

验证：

```text
pnpm typecheck                         通过
pnpm test                              27 个文件 / 148 个测试通过（删除 manifest.test.ts 后）
pnpm exec eslint <changed files>       0 error
pnpm build                             通过（44 个静态页面，新增 /admin/audit 与 /api/admin/audit）
audit route tests                      未登录 401；管理员创建分类后自动生成 create/categories 日志；
                                       markdown preview 不产生日志
production smoke                       临时 SQLite + 管理员登录：
                                       POST /api/admin/categories → 200
                                       GET /api/admin/audit?action=create&targetType=categories
                                       → total=1，actor=smoke，target_id=1，detail.path=/api/admin/categories
                                       /admin/audit → 200，SSR 含「操作审计」
                                       /api/health → db=ok，migration=0002_admin_audit_indexes.sql
```

## P3.4 旧后端下线完成（2026-10-22）

用户确认已满足三个下线条件：生产已切到 SQLite、PostgreSQL 备份可恢复、T+7 回滚窗口已过。本轮执行：

- 删除 `Kirameku-backend/`（约 1.0 GB，614 个 Git 跟踪文件；FastAPI、Vue 管理后台、`init_db.sql`、旧环境配置）。
- 删除 `Kirameku/scripts/migrate/`（`audit-pg-schema.ts`、`pg-to-sqlite.ts`、`manifest.ts`、`manifest.test.ts`）。
- 从 `Kirameku/package.json` 移除 `postgres` devDependency 及 `migrate:audit` / `migrate:pg2sqlite` 脚本，并重新生成 `pnpm-lock.yaml` 的直接依赖关系。
- `Kirameku/server/db/tables.ts` 移除仅供 PG 导入使用的 `IMPORT_ORDER` / `TABLE_BY_NAME` / `orderOf`，保留迁移测试使用的 `TABLES`。
- 更新 `README.md`、`AGENTS.md`、`DEPLOY_NOTES.md`、`Kirameku/server/db/README.md`、`.env.example` 和活跃代码注释；`DEPLOY_NOTES.md` 改写为当前单进程部署指南。
- 未修改已应用的 `0000_initial.sql` / `0001_seed_projects.sql`：迁移执行器会校验 SHA-256，且 `0001` 的 `FastAPI` 是项目技术栈种子数据，不是运行时依赖。历史文档中的 PostgreSQL 验证命令保留为历史记录，并标注迁移脚本已退役。
- 新增说明：`docs/Live2D-新增与更新.md`。

验证：

```text
pnpm typecheck                         通过
pnpm test                              27 个文件 / 148 个测试通过
pnpm exec eslint <changed files>       通过
pnpm build                             通过（44 个静态页面）
smoke                                  临时 SQLite + 管理员登录：
                                       login=200，/admin/audit=200
                                       POST /api/admin/categories → 审计 create/categories
                                       target_id=1，detail.path=/api/admin/categories
                                       /api/not-a-route → 404
                                       /api/health → db=ok，migration=0002_admin_audit_indexes.sql
```

顺带修复：`/api/health` 在多个迁移于同一毫秒应用时，原先只按 `applied_at` 排序会随机返回 `0001`；现改为 `applied_at DESC, filename DESC`，稳定返回最新迁移。默认数据库 `Kirameku/data/kirameku.db` 未参与本轮 smoke，未修改。

Live2D 的新增/更新方法见 [`docs/Live2D-新增与更新.md`](./Live2D-新增与更新.md)。
