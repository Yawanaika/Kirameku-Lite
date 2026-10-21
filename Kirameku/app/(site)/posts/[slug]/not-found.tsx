import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function PostNotFound() {
  return (
    <>
      <meta name="robots" content="noindex" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <Link
          href="/posts"
          className="inline-flex items-center gap-2 text-sm md:text-base text-slate-500 hover:text-sky-500 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          返回文章列表
        </Link>
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-400">
          <FileQuestion className="w-12 h-12 opacity-40" />
          <p className="text-base md:text-lg">文章不存在或已被删除</p>
        </div>
      </div>
    </>
  );
}
