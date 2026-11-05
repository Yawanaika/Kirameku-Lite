"use client";

import dynamic from "next/dynamic";

/**
 * 同样的道理：THREE + OrbitControls 只在用户真正打开工作室时才需要，
 * 用动态边界把它从首屏拆出去。
 */
const StudioScene = dynamic(() => import("./StudioScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-400">
      正在加载工作室…
    </div>
  ),
});

export default function StudioPage() {
  return <StudioScene />;
}
