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
};

export default nextConfig;
