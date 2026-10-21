import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppError } from "@/server/http/errors";
import { getPostsService } from "@/server/modules/posts";
import { siteConfig } from "@/siteConfig";
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
    const description = post.description || siteConfig.bio;
    const url = `${siteConfig.url}/posts/${post.slug}`;

    return {
      title: post.title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "article",
        title: post.title,
        description,
        url,
        publishedTime: post.published_at ?? undefined,
        images: post.cover ? [{ url: post.cover }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description,
        images: post.cover || undefined,
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

  return <PostDetailClient key={post.slug} initialPost={post} />;
}
