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
    <ThemeProvider>
      <EffectProvider>
        <WelcomeScreen />
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
  );
}
