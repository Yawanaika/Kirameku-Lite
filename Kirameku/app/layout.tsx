import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import "highlight.js/styles/vs2015.css";
import { siteConfig } from "@/siteConfig";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.bio,
  alternates: {
    types: {
      "application/rss+xml": "/feed",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerifSC.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
