import { siteConfig } from "@/siteConfig";
import WelcomeGreeting from "@/components/layout/WelcomeGreeting";

/**
 * Server-rendered welcome overlay.
 *
 * 除了时间问候这一小块（`WelcomeGreeting`，客户端挂载后才补文案）以外没有客户端
 * 逻辑：遮罩随初始 HTML 一起绘制，不会在水合后才成为 LCP 候选；站点布局里的阻塞
 * 脚本在首帧前就把「本会话已看过」的会话隐藏掉，退场动画也完全由 CSS 完成。
 */
export default function WelcomeScreen() {
  return (
    <div
      id="welcome-screen"
      className="fixed inset-0 z-[99999] flex items-center justify-center"
    >
      {/* 背景：纯 CSS，避免全屏图片和模糊滤镜拖慢首屏。 */}
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.14),transparent_60%)]" />

      {/* 内容 */}
      <div className="relative z-10 text-center px-6">
        {/* 欢迎来到 */}
        <p className="welcome-fade text-lg md:text-xl text-slate-400 mb-4 tracking-[0.3em]">
          欢迎来到
        </p>

        {/* 站名 */}
        <div className="flex items-center justify-center space-x-1 mb-4">
          <span
            className="text-4xl md:text-5xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
          >
            {siteConfig.authorName}
          </span>
          <span
            className="text-4xl md:text-5xl font-bold text-sky-400"
            style={{ fontFamily: "serif" }}
          >
            の
          </span>
          <span
            className="text-4xl md:text-5xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
          >
            小站
          </span>
        </div>

        {/* 时间问候：客户端挂载后按本地时区补文案，避免构建时间固化进静态 HTML，
            也避免「内联脚本先改 DOM、React 后水合」造成的 hydration mismatch。 */}
        <WelcomeGreeting />

        {/* 装饰线 */}
        <div className="welcome-line mx-auto mt-8 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
      </div>
    </div>
  );
}
