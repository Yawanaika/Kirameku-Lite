# P3 后台业务 UI 记录

日期：2026-10-21

## 本轮范围

后台从「登录 + 仪表盘空壳」推进到 13 个业务模块全部有管理入口（图片上传控件除外）：

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

侧边栏已改为真实路由导航，并根据当前路径高亮；12 个业务入口全部可点击。

## 实现方式

- 后台页面沿用 `app/(admin)/admin/(protected)` 布局，服务端 `getAdminSession()` 统一鉴权；未登录访问业务页会 307 到 `/admin/login`。
- 列表和表单通过浏览器 `fetch` 调用现有 `/api/admin/*`，携带管理员 Cookie；写操作由浏览器自动带 `Origin`，服务端继续执行 `assertWritable()`、`assertSameOrigin()` 和 `requireAdmin()`。
- `components/admin/admin-api.ts` 统一处理 JSON 请求、错误消息和 422 字段错误；401 时跳转登录页。
- `components/admin/use-admin-data.ts` 统一处理列表加载、错误、刷新和 AbortController 取消请求；加载状态与请求 path/version 绑定，避免 effect 内同步 setState。
- `components/admin/AdminNav.tsx` 使用 `usePathname()` 高亮当前模块。
- 新增 `lib/utils.ts` 和 `components/ui/*`：`Button`、`Input`、`Textarea`、`Select`、`Label`、`Badge`、`Card`、`Table`。组件按 shadcn 的 `cn` + CVA 结构组织，当前使用原生表单控件，尚未引入 Radix Dialog/Select。
- 删除操作使用浏览器确认框；文章/说说/评论/留言/项目/相册/收藏分类的删除语义与后台 API 一致，评论/留言删除会级联回复，相册删除会级联照片，收藏分类删除会级联站点。
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
2. 引入 Radix Dialog/Select、TanStack Table 或 react-hook-form（按实际复杂度决定），替换浏览器确认框和手写表格状态。
3. ~~文章编辑器接入 CodeMirror 和 Markdown 预览。~~ 已在 P5.2 完成。
4. 后台移动端导航已完成（P5.2）；操作审计日志和更细的权限控制仍开放。
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

结论：`Kirameku/` 运行时已经不依赖 `Kirameku-backend/`，但当前不建议直接删除；先完成代理清理、全站 smoke 和生产切流确认。

已确认：

- `siteConfig.apiBaseUrl` 为 `""`，前端请求全部走同源 `/api/*`。
- 文章、评论、留言、相册、项目、收藏夹、友链、站点配置、访客、认证等接口均有本地 Route Handler。
- `/api/music`、`/api/uapis` 已是 Next 本地反代外部服务，不再经过 FastAPI。
- 图片上传已迁到 `/api/admin/upload/image`，本地文件由 `/uploads/[...path]` 提供。
- `Kirameku-backend/uploads/` 不存在，没有本地图片文件需要先迁移。

删除前必须处理：

1. [ ] 删除 `Kirameku/next.config.mjs` 中的两条 fallback rewrite（`/api/:path*`、`/uploads/:path*` → `127.0.0.1:8000`），并确认未命中的路径返回预期 404，而不是误代理。
2. [ ] 跑一次全站 smoke：公开页面/API、后台登录与 CRUD、图片上传、RSS、sitemap、`/api/health`。
3. [ ] 确认生产已切到 SQLite，PostgreSQL 备份可恢复，且已经超过 `T+7` 回滚窗口。
4. [ ] 删除 `Kirameku-backend/`，同步更新 `README.md`、`AGENTS.md`、`DEPLOY_NOTES.md` 和迁移文档中的旧后端描述。
5. [ ] 若确认不再需要 PostgreSQL → SQLite 迁移，再清理 `postgres` devDependency、`init_db.sql` 引用和迁移脚本说明；否则先保留迁移脚本。

注意：源码可以从 Git 历史恢复，但生产 PostgreSQL 数据、旧环境变量、旧 Nginx 配置和回滚窗口不能仅靠仓库历史恢复。

## P5.1 收尾进展（2026-10-22）

- 删除前检查 1、2 已完成：`next.config.mjs` 的 `/api/*`、`/uploads/*` fallback rewrites 已移除，未命中路径返回 404；临时 SQLite + 管理员会话的全站 smoke 通过（公开页、后台 14 页、CRUD、上传、RSS/sitemap、限流、浏览量去重）。
- P3.1 记录中写的 `GET /uploads/[...path]` 当时实际并未落库，导致本地上传写入成功但读取 404；P5.1 已补齐并通过 smoke。
- 新增 `/admin/account`（资料/改密），补齐后台最后一项账号入口。
- 删除前检查 3、4、5 仍未完成：生产 SQLite 切流、PostgreSQL 备份可恢复、T+7 回滚窗口都需要运维确认后，才能删除 `Kirameku-backend/` 并清理 `postgres` devDependency。
- 后续项 2、4（Radix Dialog、操作审计/细粒度权限）仍开放；CodeMirror 编辑器、Markdown 预览、后台移动端导航已在 P5.2 完成。

## P5.2 后台编辑体验（2026-10-22）

- 文章编辑器正文从 `<Textarea>` 换成 CodeMirror 6（复用仓库已有的 `codemirror` / `@codemirror/lang-markdown` / `@codemirror/theme-one-dark`）。`components/admin/MarkdownEditor.tsx` 封装受控编辑器：视图只创建一次，外部加载文章时通过 dispatch 同步内容，不重建编辑器。
- 新增编辑/分栏/预览三种视图；预览通过 `POST /api/admin/markdown/preview` 走服务端 `lib/markdown.ts`，与前台文章页使用同一套 `remark → rehype-sanitize → rehype-highlight` 管线，输入上限 200,000 字符。客户端不引入第二套 Markdown 渲染器，也不把原始 HTML 交给 `dangerouslySetInnerHTML`。
- 预览请求 400ms 防抖并可中止，避免快速输入时堆积请求；管理员会话 + 同源检查。
- 后台移动端导航：`AdminShell` 侧栏在 `lg` 以下隐藏，新增 `AdminMobileNav` 抽屉（Escape/遮罩关闭、路由切换自动收起、焦点还原、Tab 焦点环、锁定滚动、桌面断点自动关闭）；桌面侧栏改为 sticky 独立滚动。
- 同轮补齐 `GET /api/admin/albums/[id]`、`GET /api/admin/visitors/count` 与 Markdown 预览的路由级测试（见 P5 记录第 10 节）。
- 验证：`/admin` SSR 含移动导航入口，`/admin/posts/new` SSR 含视图切换；未登录预览 401、管理员预览 200 且 `<script>` 被清除、代码块带 `hljs-*`、超长正文 422；27 个测试文件 / 145 个测试通过，生产 build 44 个静态页面。

详见 [`docs/P5-加固验证记录.md`](./P5-加固验证记录.md)。
