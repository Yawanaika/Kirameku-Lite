import type { Metadata } from "next";
import "./globals.css";
import "highlight.js/styles/atom-one-dark.css";
import { siteConfig } from "@/siteConfig";
import { getShareConfig, getSiteUrl } from "@/server/site";

const share = getShareConfig();

export const metadata: Metadata = {
  // metadataBase lets the rest of the app write root-relative URLs (icons,
  // per-page openGraph images) and have Next resolve them to the public origin.
  metadataBase: new URL(getSiteUrl()),
  title: siteConfig.title,
  description: share.description,
  alternates: {
    types: {
      "application/rss+xml": "/feed",
    },
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.title,
    locale: "zh_CN",
    title: share.title,
    description: share.description,
    url: getSiteUrl(),
    images: share.image ? [{ url: share.image, alt: share.title }] : undefined,
  },
  twitter: {
    card: share.card,
    title: share.title,
    description: share.description,
    images: share.image ?? undefined,
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
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
