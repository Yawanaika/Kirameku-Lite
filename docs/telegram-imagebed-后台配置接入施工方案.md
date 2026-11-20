# Telegram 图床后台配置接入施工方案

> 状态：待施工方案。当前只记录设计与验收要求，不代表已实现。  
> 目标服务：CloudFlare ImgBed，使用 Telegram 上传渠道。  
> API 文档：<https://cfbed.sanyue.de/api/>

## 1. 目标

在后台「站点设置」中新增「图床设置」，由管理员配置图床地址、API Token、上传目录和启用状态。新上传可切换到 ImgBed；关闭后保持现有 OSS／本地存储行为。无需新增图床专用环境变量。

本期只处理新上传和配置管理；旧图片保持原 URL 访问，不自动迁移、不自动删除。

## 2. 现状与关键约束

- 项目为 Next.js 16 / React 19 单进程应用，图片上传由后端 Route Handler 代理。
- 上传入口：[上传接口](../Kirameku/app/api/admin/upload/image/route.ts)、[存储入口](../Kirameku/server/storage/index.ts)、[图片校验](../Kirameku/server/storage/image.ts)、[上传控件](../Kirameku/components/admin/ImageUploader.tsx)。
- 站点设置界面：[SiteSettingsManager](../Kirameku/components/admin/SiteSettingsManager.tsx)。
- 站点配置的公开读取接口会返回通用配置集合，后台通用配置列表也会返回完整配置值。因此**不能把图床 Token 放入通用 site_config**，即使只打算保存密文。
- 项目通知模块已有 AES-256-GCM 密钥封装与掩码返回实现：[密钥封装](../Kirameku/server/modules/notifications/secrets.ts)、[通知服务](../Kirameku/server/modules/notifications/service.ts)。图床配置可复用该安全模式，避免重复实现。
- 数据库迁移必须新增文件，不得修改已应用迁移；详见[数据库说明](../Kirameku/server/db/README.md)。

## 3. 方案概览

后台浏览器只与 Kirameku 管理接口通信。Kirameku 服务端读取并解密 Token，再以 Bearer Token 调用 ImgBed。Token 不进入前端包、公开站点配置、浏览器网络请求、错误响应或日志。

图床配置存放在独立的数据库表中，不能混入公开设置；配置页只返回是否已配置，不返回明文或密文。图床默认关闭，完成配置和验证后由管理员主动启用。

## 4. 配置项与数据库

新增独立的单行配置表，建议命名 imagebed_settings，字段如下：

| 字段 | 含义 |
|:---|:---|
| id | 单行配置主键，固定为 1 |
| enabled | 是否将新上传路由到 ImgBed，默认 false |
| base_url | 图床服务根地址，不带 /upload |
| api_token | 加密后的 API Token |
| upload_channel | 第一版固定 telegram |
| upload_folder | 可选上传目录 |
| updated_at | 更新时间 |

增加新的编号迁移，并在 schema index 中注册。数据库只存一份生效配置，不做多服务、多 Token 管理。

新增 server-only 图床模块，职责分开：

- contracts.ts：后台读写 schema 和类型校验；
- service.ts：配置读取、保存、加密、掩码和启用前校验；
- client.ts：构造 ImgBed 上传请求并解析响应；
- index.ts：导出服务端公开接口。

数据库模型、后台响应和上传运行时使用不同类型，避免密文或明文 Token 误传到浏览器。

## 5. Token 安全与配置接口

### 5.1 加密和密钥

复用通知模块的 AES-256-GCM 封装模式，使用现有 AUTH_SECRET 派生加密密钥；不新增 IMAGEBED_* 环境变量。生产环境需保持 AUTH_SECRET 稳定。若更换密钥，已有图床 Token 可能无法解密，需要重新配置。

生产环境不得以明文方式保存 Token；如果无法生成密文，应拒绝启用图床并给出安全错误。禁止在日志中输出 Token、Authorization 请求头或上游完整错误正文。

### 5.2 专用管理接口

新增：

- GET /api/admin/imagebed-settings：只返回 enabled、baseUrl、uploadChannel、uploadFolder、tokenConfigured 等脱敏字段；
- PUT /api/admin/imagebed-settings：校验并保存配置。

两个接口均使用管理员认证。写操作还必须进行同源校验、可写状态检查和 Zod 校验。不要复用公开的 /api/site-config，也不要把图床配置加入通用站点配置接口。

Token 表单语义：

- GET 不返回 Token，只返回 tokenConfigured 布尔值；
- PUT 中 Token 留空表示保留现有值；
- 更新 Token 时加密后覆盖旧值；
- 清除 Token 使用显式 clearApiToken 操作，并自动关闭图床；
- 不把“已配置”掩码作为真实 Token 提交回后端。

### 5.3 图床地址的 SSRF 防护

因为服务端会请求后台填写的 URL，baseUrl 必须严格校验：只接受绝对 HTTP(S) URL，拒绝用户名密码、查询串和片段；生产优先要求 HTTPS；拒绝 localhost、云元数据地址及未明确允许的内网目标。关闭自动跟随重定向，或验证每次跳转仍在允许范围，避免配置被利用为 SSRF 入口。若确有内网图床部署需求，应另行明确允许的域名/网段策略，不要直接放开任意目标。

## 6. 后台界面

在 SiteSettingsManager 现有页签中新增「图床设置」，复用现有表单布局与保存反馈。第一版字段：

| 字段 | 行为 |
|:---|:---|
| 启用图床 | 开关；启用前要求地址和 Token 已配置 |
| 图床地址 | URL 输入；保存时规范化去除末尾斜杠 |
| API Token | password 输入；已配置时显示状态，不显示原值 |
| 上传渠道 | 第一版固定 telegram，可只读展示 |
| 上传目录 | 可选文本输入，限制长度和字符 |

说明文案应明确：启用只影响新上传；已有图片不会自动迁移；图床故障时不会自动回退到本地/OSS。

「测试连接」可作为可选项。不要通过真实上传进行无副作用测试。只有在明确采用具有 list 权限的 Token 时，才可以由服务端调用列表接口做连接检查；否则第一版可不做测试按钮。

## 7. ImgBed 上传适配

新增 server-only 客户端，调用文档定义的普通上传 API：

- POST {baseUrl}/upload；
- Query：uploadChannel=telegram、returnFormat=full、responseFormat=object；
- Header：Authorization: Bearer <服务端解密的 Token>；
- Multipart 字段：file；按配置可传 uploadFolder。

客户端要求：

1. 继续先执行项目现有的文件大小、图片格式、魔数和尺寸校验；第一版保持当前 10MB 上限，不因图床可能支持更大文件而自动提高。
2. 设置请求超时；处理网络错误、401/403、413、429、5xx、非 JSON 和缺少 src 等情况。
3. 校验 src 必须是字符串；若为相对路径，基于经过校验的 baseUrl 转成完整 URL；publicUrl 为可选字段。
4. 防御性兼容文档默认数组和 object 响应，优先请求 object 格式。
5. 上传结果应保留展示 URL 和删除/对账用的 remotePath（图床路径或 ID），但不要把完整 URL 当作删除接口的 path。
6. 不将上游响应体原样透传给浏览器，错误内容需脱敏和限长。

可以为上传请求使用 upload 权限最小化 Token；只有实现列表测试时才需要 list 权限。不要为了第一版启用无关的 manage 权限。

## 8. 存储切换和错误策略

修改存储选择逻辑：

- 图床关闭：现有 OSS / local 路径完全不变；
- 图床开启且配置有效：新上传写入 ImgBed，storage 类型增加 imagebed；
- 图床开启但配置缺失或不可解密：明确报错，不上传；
- 图床请求失败：明确报错，**不静默回退**到 OSS 或本地。

不要自动迁移历史 URL。也不要因为关闭图床就删除远程图片或本地旧文件。后台上传返回的 url 应适配现有编辑器使用方式；若未来需要删除、迁移或对账，需先确保持久化 remotePath 与业务图片引用关系。

## 9. 备份、部署与回滚

现有 SQLite/本地上传备份继续保留。SQLite 备份会包含加密后的图床配置，但不会包含 Telegram 上的远程图片对象；必须明确区分“配置可恢复”和“图片对象可恢复”。

推荐发布顺序：

1. 新增数据库迁移、独立配置服务和脱敏管理 API；默认 enabled=false。
2. 加入设置页和图床上传客户端，保持旧存储路径兼容。
3. 部署后在后台填写配置，先不启用；确认重读只显示已配置状态。
4. 启用并用小文件验证上传、访问 URL 和前台展示。
5. 观察日志、图床状态和图片访问后再持续使用。

回滚优先通过后台关闭开关，使后续新上传回到旧 OSS/local；保留数据库配置和已上传远程文件。即使回滚应用，已写入内容的 ImgBed URL 仍应可直接访问。

## 10. 测试与验收

### 单元测试

- URL 校验、规范化和 SSRF 规则；
- Token 加密、解密、掩码、留空保留和显式清除；
- 图床 object/array 响应解析、相对 src 处理、缺少 src；
- 超时、网络错误、401、403、413、429、5xx、非 JSON。

### API 与上传测试

- 未登录访问被拒绝；非同源写入和只读模式写入被拒绝；
- GET 不返回明文或加密 Token；
- 图床关闭时 local/OSS 行为不变；开启时 multipart 字段与 query 参数正确；
- 图床失败时没有本地/OSS 隐式落盘；
- 历史图片访问不受影响；
- 日志、响应和前端资源中均无 Token。

### 项目检查

按仓库 CI 顺序运行 typecheck、tests、db:migrate 和 build；需要时再运行 lint。对 SQLite 使用仓库规定的迁移、备份流程，不直接复制运行中的数据库文件。

完成标准：后台可管理图床配置；Token 加密且不回显；开关控制新上传；旧图片兼容；错误不回退；迁移、测试和构建通过。

## 11. 后续阶段（不属于第一版）

若需要可靠删除、历史迁移和资源对账，再单独设计媒体资源表，保存 storage、url、remotePath、mimeType、size、宽高、业务引用和删除状态。完成引用关系及孤儿资源审计后，再实现单删/批量删和迁移脚本。不要在仅保存 URL 的现状下直接自动删除远程图片。
