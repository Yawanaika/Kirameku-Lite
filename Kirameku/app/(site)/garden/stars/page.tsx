"use client";

import dynamic from "next/dynamic";

/**
 * three.js + @react-three/fiber 打包后接近 1MB，是 /garden/stars 首屏体积的全部来源。
 * 这里只保留一个动态边界：场景在页面水合之后才去下载 three，
 * 首屏 HTML 与主 chunk 都不再包含它。
 */
const PlanetScene = dynamic(() => import("./PlanetScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#05060a] text-sm text-slate-400">
      正在加载星空…
    </div>
  ),
});

export default function StarsPage() {
  return <PlanetScene />;
}
