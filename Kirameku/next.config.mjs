import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  compress: true,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: path.resolve(__dirname),
  },

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    // 这里只登记可信的固定图源。来自后台配置或用户输入的外部图片地址是不可预测的，
    // 一律在组件里用 unoptimized 交给浏览器直连（见 lib/image.ts），不经过 /_next/image 代理，
    // 所以不需要、也不应该把 remotePatterns 放宽到任意主机。
    remotePatterns: [
      { protocol: "https", hostname: "static.hiromu.top" },
      { protocol: "https", hostname: "hiromu520.oss-cn-beijing.aliyuncs.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  /**
   * 安全响应头。
   *
   * 这里而不是反代里，是因为部署时通常复用一台别的 Caddy（见 DEPLOY_NOTES），
   * 仓库里的 Caddyfile 只在自带 Caddy 时生效；写在应用里则无论前面挂什么都会带上，
   * 也不会和反代重复下发同名头。
   *
   * CSP 刻意保持最小：Next.js 要注入内联 bootstrap 脚本、组件要写内联样式、
   * 图片来自后台可配置的任意域名，加 `default-src` 会直接打白页面。
   * 因此只锁死真正没有理由放松的三条（禁止插件对象、禁止改 base、禁止被外站嵌套）。
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
          },
          // 一年有效期；HTTP 下浏览器会忽略，只在 HTTPS 期间生效。
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
