-- Seed the projects that previously lived in `app/(site)/projects/projectsData.ts`.
--
-- The project table is now the single source of truth. `INSERT OR IGNORE`
-- keeps this migration idempotent and avoids overwriting a slug that an
-- operator may have already imported or edited before applying this file.

INSERT OR IGNORE INTO "project" (
  "name",
  "slug",
  "description",
  "long_description",
  "cover_image",
  "tech_stack",
  "link_github",
  "link_gitee",
  "link_live",
  "link_docs",
  "status",
  "status_label",
  "is_featured",
  "sort",
  "created_at",
  "updated_at"
) VALUES (
  'HAXAtom',
  'haxatom',
  '原子化解耦 · 乐高式拼装 — 全栈 AI 智能体管理与多端分发平台',
  '基于 LangChain/LangGraph 的 AI 智能体管理平台，支持 RAG 知识库、可视化 Agent 编排、多渠道分发（Web、飞书、钉钉、QQ、Telegram）。采用原子化架构设计，模块可自由组合，乐高式拼装。',
  '/images/projects/haxatom.webp',
  '["Python","Vue 3","FastAPI","LangChain","LangGraph","RAG"]',
  'https://github.com/Xinghongia/HAXAtom',
  '',
  '',
  '',
  'active',
  '维护中',
  1,
  0,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
);

INSERT OR IGNORE INTO "project" (
  "name",
  "slug",
  "description",
  "long_description",
  "cover_image",
  "tech_stack",
  "link_github",
  "link_gitee",
  "link_live",
  "link_docs",
  "status",
  "status_label",
  "is_featured",
  "sort",
  "created_at",
  "updated_at"
) VALUES (
  'StarVid 星河',
  'starvid',
  '全功能即时通讯社交应用 — 实时聊天、好友管理、群组、朋友圈',
  '前后端分离架构的 IM 社交应用，支持文本/图片/语音/视频/文件消息、好友管理、群聊 @ 功能、朋友圈动态、WebSocket 实时推送、JWT 双令牌认证。前端 Flutter + GetX，后端 Spring Boot + MyBatis-Plus + MySQL + Redis。',
  '/images/projects/starvid.webp',
  '["Flutter","Spring Boot","MySQL","Redis","WebSocket","GetX","MyBatis-Plus"]',
  '',
  'https://gitee.com/hongzyh/xinhe',
  '',
  '',
  'active',
  '开发中',
  0,
  1,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
);

INSERT OR IGNORE INTO "project" (
  "name",
  "slug",
  "description",
  "long_description",
  "cover_image",
  "tech_stack",
  "link_github",
  "link_gitee",
  "link_live",
  "link_docs",
  "status",
  "status_label",
  "is_featured",
  "sort",
  "created_at",
  "updated_at"
) VALUES (
  'hiromu.top',
  'hiromu-top',
  '资源分享站点',
  '基于 Vue 构建的资源分享网站，提供丰富的前端交互体验和优质的资源分享。',
  '/images/projects/hiromu-top.webp',
  '["Vue","APlayer","Live2D","CSS3"]',
  '',
  '',
  'https://hiromu.top/',
  '',
  'active',
  '已上线',
  0,
  2,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
);
