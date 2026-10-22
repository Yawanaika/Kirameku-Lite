import { Geist_Mono } from "next/font/google";
import "highlight.js/styles/vs2015.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { BackgroundProvider } from "@/components/providers/BackgroundProvider";
import { MusicProvider } from "@/components/providers/MusicProvider";
import { EffectProvider } from "@/components/providers/EffectProvider";
import BackgroundRenderer from "@/components/layout/BackgroundRenderer";
import Navbar from "@/components/layout/Navbar";
import ClientWidgets from "@/components/layout/ClientWidgets";
import ClickEffect from "@/components/ui/ClickEffect";
import RadialMenu from "@/components/ui/RadialMenu";
import MouseTrail from "@/components/ui/MouseTrail";
import SeasonalEffect from "@/components/ui/SeasonalEffect";
import KiraSparkle from "@/components/ui/KiraSparkle";
import WelcomeScreen from "@/components/layout/WelcomeScreen";
import VisitorTracker from "@/components/layout/VisitorTracker";
import { WELCOME_SESSION_KEY } from "@/lib/welcome";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/*
        阻塞式引导脚本：在首次绘制前确定「欢迎屏是否已看」与「明暗主题」，
        这样服务端 HTML 不必猜测客户端状态，也就不会产生水合不匹配
        （主题相关的图标改用 CSS 切换，见 Navbar）。
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var s=sessionStorage.getItem(${JSON.stringify(WELCOME_SESSION_KEY)});if(s){document.documentElement.classList.add("welcome-seen")}else{sessionStorage.setItem(${JSON.stringify(WELCOME_SESSION_KEY)},"1")}}catch(e){}try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.dataset.theme=t;}catch(e){}`,
        }}
      />
      <ThemeProvider>
        <EffectProvider>
          {process.env.WELCOME_DISABLED === "1" ? null : <WelcomeScreen />}
        <BackgroundProvider>
          <MusicProvider>
            <ToastProvider>
              <div
                className={`${geistMono.variable} flex min-h-screen flex-col`}
              >
                <BackgroundRenderer />
                <VisitorTracker />
                <ClickEffect />
                <RadialMenu />
                <MouseTrail />
                <SeasonalEffect />
                <KiraSparkle />
                <Navbar />
                <main className="flex-1 pt-16">{children}</main>
                <ClientWidgets />
              </div>
            </ToastProvider>
          </MusicProvider>
        </BackgroundProvider>
      </EffectProvider>
      </ThemeProvider>
    </>
  );
}
