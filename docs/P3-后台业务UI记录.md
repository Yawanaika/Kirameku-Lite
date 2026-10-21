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

1. 图片上传迁移到本地/对象存储，随后把相册照片 URL 输入替换为上传控件。
2. 引入 Radix Dialog/Select、TanStack Table 或 react-hook-form（按实际复杂度决定），替换浏览器确认框和手写表格状态。
3. 文章编辑器接入 CodeMirror 和 Markdown 预览。
4. 后台移动端导航、操作审计日志和更细的权限控制。
5. 为新增的 `GET /api/admin/albums/[id]`、`GET /api/admin/visitors/count` 补充路由级测试。
