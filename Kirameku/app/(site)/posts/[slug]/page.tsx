import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";
import { AppError } from "@/server/http/errors";
import { getPostsService } from "@/server/modules/posts";
import { getShareConfig, shareImageUrl, siteUrl } from "@/server/site";
import PostDetailClient from "./PostDetailClient";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getPost = cache(async (slug: string) => {
  return getPostsService().getBySlug(slug, { publishedOnly: true });
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await getPost(slug);
    const url = siteUrl(`/posts/${post.slug}`);
    // Fall back to the configured site share card for description and image so
    // a post without a cover still produces a complete preview.
    const share = getShareConfig({
      title: post.title,
      description: post.description,
      image: post.cover ? shareImageUrl(post.cover) : undefined,
    });

    return {
      title: post.title,
      description: share.description,
      alternates: { canonical: url },
      openGraph: {
        type: "article",
        title: share.title,
        description: share.description,
        url,
        publishedTime: post.published_at ?? undefined,
        images: share.image ? [{ url: share.image }] : undefined,
      },
      twitter: {
        card: share.card,
        title: share.title,
        description: share.description,
        images: share.image ?? undefined,
      },
    };
  } catch {
    return {
      title: "文章不存在",
      robots: { index: false, follow: false },
    };
  }
}

export default async function PostDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const post = await getPost(slug).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) {
      return null;
    }
    throw error;
  });

  if (!post) notFound();

  const { content, ...initialPost } = post;
  const contentHtml = await renderMarkdown(content);

  return (
    <PostDetailClient
      key={post.slug}
      initialPost={initialPost}
      contentHtml={contentHtml}
    />
  );
}
