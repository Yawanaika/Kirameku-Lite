"use client";

import dynamic from "next/dynamic";

/**
 * CodeMirror 6 一整套（state/view/basicSetup/markdown/oneDark）打包后接近 500KB，
 * 只有管理后台打开文章编辑器时才需要。这里用动态边界把它推迟到客户端加载，
 * 避免它进入 /admin/posts 的首屏 chunk。
 *
 * 加载期间用同样高度的占位，避免布局跳动。
 */
const MarkdownEditorCore = dynamic(() => import("./MarkdownEditorCore"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/60 dark:border-white/10 dark:bg-slate-900/40">
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        正在加载编辑器…
      </div>
    </div>
  ),
});

export interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

export default function MarkdownEditor(props: MarkdownEditorProps) {
  return <MarkdownEditorCore {...props} />;
}
