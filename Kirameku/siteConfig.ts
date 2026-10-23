// siteConfig.ts - 全站配置中心

export const siteConfig = {
  // 网站标题与博主信息
  title: "Yawanaikaの秘密小窝",
  // 兜底值：站点 URL 优先取 SITE_URL，其次 FRONTEND_ORIGIN（见 server/site.ts）。
  // 只有两者都没配置时才会用到这里，正常部署不需要改这一行。
  url: "https://blog.yawanaika.com",
  authorName: "Yawanaika",
  bio: "不想起床->不想上班->好饿->好困->好想下班->我还不困",

  // 头像设置
  avatarUrl: "/images/middlenightcat.jpg",

  // 分享卡片（Open Graph / Twitter）兜底值；可用 SITE_SHARE_* 环境变量覆盖
  shareImage: "/images/middlenightcat.jpg",
  shareCard: "summary_large_image" as const,

  // 背景设置
  useGradient: false,
  themeColors: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"],
  bgImages: [
    "/images/1.webp",
    "/images/42.webp",
    "/images/20.webp",
    "/images/36.webp",
    "/images/39.webp",
    "/images/41.webp",
  ],

  // 默认封面图
  defaultPostCover: "/images/default-cover.jpg",

  // 照片墙预览图
  photoWallImage: "/images/photo-wall.jpg",

  // 云音乐配置（网易云音乐）
  // 填歌单 ID 则自动拉取整个歌单，填歌曲 ID 列表则只播放指定歌曲
  cloudMusicPlaylistId: "17943739323",  // 歌单 ID（优先）
  cloudMusicIds: [],                     // 歌曲 ID 列表（歌单为空时使用）

  // 社交链接
  social: {
    github: "https://github.com/yawanaika",
    email: "hello@yawanaika.com",
    wechat: "Yawanaika",
    tg: "https://t.me/AYuiMe",
  },

  // 站点信息
  buildDate: "2026-10-22T12:00:00",
  footerBadges: [
    { name: "Next.js 15", color: "text-sky-500" },
    { name: "React 19", color: "text-cyan-400" },
    { name: "Tailwind 4", color: "text-teal-400" },
  ],
  icpConfig: {
    name: "",
    link: "",
  },
  moeIcpConfig: {
    name: "",
    link: "",
  },

  // 分类标题
  chatterTitle: "留言",
  chatterDescription: "生活、技术、随想的碎片记录",
};
