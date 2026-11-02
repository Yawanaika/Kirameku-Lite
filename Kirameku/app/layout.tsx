import type { Metadata } from "next";
import "./globals.css";
import "highlight.js/styles/atom-one-dark.css";
import { loadSiteSettings } from "@/server/modules/site-settings";
import { buildShareConfig, getSiteUrl } from "@/server/site";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSiteSettings();
  const share = buildShareConfig(settings);

  return {
    // metadataBase lets the rest of the app write root-relative URLs (icons,
    // per-page openGraph images) and have Next resolve them to the public origin.
    metadataBase: new URL(getSiteUrl()),
    title: settings.profile.siteTitle,
    description: share.description,
    alternates: {
      types: {
        "application/rss+xml": "/feed",
      },
    },
    openGraph: {
      type: "website",
      siteName: settings.profile.siteTitle,
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
}

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
