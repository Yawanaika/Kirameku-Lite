"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import AdminError from "./AdminError";
import ImageUploader from "./ImageUploader";
import { adminRequest, describeAdminError } from "./admin-api";
import { useAdminData } from "./use-admin-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CategoryItem,
  PostDetail,
  TagItem,
} from "@/server/modules/posts/contracts";

interface PostEditorProps {
  postId?: number;
}

interface FormState {
  title: string;
  slug: string;
  description: string;
  content: string;
  cover: string;
  categoryId: string;
  tags: string;
  status: string;
  isPinned: boolean;
}

const emptyForm: FormState = {
  title: "",
  slug: "",
  description: "",
  content: "",
  cover: "",
  categoryId: "",
  tags: "",
  status: "draft",
  isPinned: false,
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export default function PostEditor({ postId }: PostEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categoryName, setCategoryName] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(postId));
  const [loadingPost, setLoadingPost] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: categories } = useAdminData<CategoryItem[]>(
    "/api/admin/categories",
  );
  const { data: tags } = useAdminData<TagItem[]>("/api/admin/tags");

  useEffect(() => {
    if (!postId) return;
    let active = true;
    adminRequest<PostDetail>(`/api/admin/posts/${postId}`)
      .then((post) => {
        if (!active) return;
        setCategoryName(post.category);
        setForm({
          title: post.title,
          slug: post.slug,
          description: post.description,
          content: post.content,
          cover: post.cover,
          categoryId: "",
          tags: post.tags.join(", "),
          status: post.status,
          isPinned: post.is_pinned,
        });
      })
      .catch((reason: unknown) => {
        if (active) setError(describeAdminError(reason));
      })
      .finally(() => {
        if (active) setLoadingPost(false);
      });
    return () => {
      active = false;
    };
  }, [postId]);

  const selectedCategoryId =
    form.categoryId ||
    (categoryName
      ? String(
          categories?.find((item) => item.name === categoryName)?.id ?? "",
        )
      : "");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateTitle(value: string) {
    setForm((current) => ({
      ...current,
      title: value,
      slug: slugTouched ? current.slug : slugify(value),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.slug.trim()) {
      setError("标题和 slug 不能为空");
      return;
    }

    const body = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description,
      content: form.content,
      cover: form.cover.trim(),
      category_id: selectedCategoryId ? Number(selectedCategoryId) : null,
      tags: splitTags(form.tags),
      status: form.status,
      is_pinned: form.isPinned,
    };

    setSaving(true);
    setError(null);
    try {
      await adminRequest(postId ? `/api/admin/posts/${postId}` : "/api/admin/posts", {
        method: postId ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      router.push("/admin/posts");
      router.refresh();
    } catch (reason) {
      setError(describeAdminError(reason));
      setSaving(false);
    }
  }

  async function remove() {
    if (!postId) return;
    if (!window.confirm("确定删除这篇文章？此操作不可撤销。")) return;
    setDeleting(true);
    setError(null);
    try {
      await adminRequest(`/api/admin/posts/${postId}`, { method: "DELETE" });
      router.push("/admin/posts");
      router.refresh();
    } catch (reason) {
      setError(describeAdminError(reason));
      setDeleting(false);
    }
  }

  if (loadingPost) {
    return (
      <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-500">
        正在加载文章…
      </div>
    );
  }

  const wordCount = form.content.length;
  const readingTime = wordCount > 0 ? Math.max(1, Math.floor(wordCount / 300)) : 0;

  return (
    <form onSubmit={submit} className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/posts"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            返回文章列表
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {postId ? "编辑文章" : "新建文章"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {postId ? `文章 ID #${postId}` : "正文支持 Markdown，保存后可继续编辑。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {postId ? (
            <Button
              variant="destructive"
              onClick={remove}
              disabled={deleting || saving}
            >
              <Trash2 className="size-4" aria-hidden />
              {deleting ? "删除中…" : "删除"}
            </Button>
          ) : null}
          <Link href="/admin/posts" className={buttonVariants({ variant: "outline" })}>
            取消
          </Link>
          <Button type="submit" disabled={saving || deleting}>
            <Save className="size-4" aria-hidden />
            {saving ? "保存中…" : "保存文章"}
          </Button>
        </div>
      </header>

      {error ? <AdminError message={error} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="post-title">标题</Label>
                <Input
                  id="post-title"
                  value={form.title}
                  onChange={(event) => updateTitle(event.target.value)}
                  placeholder="文章标题"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-slug">Slug</Label>
                <Input
                  id="post-slug"
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    update("slug", event.target.value);
                  }}
                  placeholder="article-slug"
                  required
                />
                <p className="text-[11px] text-slate-600">
                  前台地址：/posts/{form.slug || "your-slug"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-description">摘要</Label>
                <Textarea
                  id="post-description"
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="用于列表和 SEO 的简短描述"
                  className="min-h-20"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-3 flex items-center justify-between">
              <Label htmlFor="post-content">正文（Markdown）</Label>
              <span className="text-[11px] text-slate-600 tabular-nums">
                {wordCount} 字符 · 约 {readingTime} 分钟
              </span>
            </div>
            <Textarea
              id="post-content"
              value={form.content}
              onChange={(event) => update("content", event.target.value)}
              placeholder="# 正文开始…"
              className="min-h-[420px] font-mono text-[13px] leading-6"
            />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-sm font-semibold text-white">发布设置</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="post-status">状态</Label>
                <Select
                  id="post-status"
                  value={form.status}
                  onChange={(event) => update("status", event.target.value)}
                >
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-category">分类</Label>
                <Select
                  id="post-category"
                  value={selectedCategoryId}
                  onChange={(event) => {
                    setCategoryName("");
                    update("categoryId", event.target.value);
                  }}
                >
                  <option value="">未分类</option>
                  {(categories ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-tags">标签</Label>
                <Input
                  id="post-tags"
                  value={form.tags}
                  onChange={(event) => update("tags", event.target.value)}
                  placeholder="React, Next.js"
                />
                <p className="text-[11px] text-slate-600">
                  用逗号分隔；不存在的标签会自动创建。
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) => update("isPinned", event.target.checked)}
                  className="size-3.5 rounded border-white/20 bg-slate-950 accent-sky-400"
                />
                置顶文章
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-sm font-semibold text-white">封面</h2>
            <div className="mt-4">
              <ImageUploader
                id="post-cover"
                label="封面图片"
                value={form.cover}
                onChange={(url) => update("cover", url)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-xs text-slate-500">
            <p className="font-medium text-slate-300">已有标签</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(tags ?? []).length > 0 ? (
                (tags ?? []).map((item) => (
                  <span
                    key={item.id}
                    className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500"
                  >
                    {item.name}
                  </span>
                ))
              ) : (
                <span className="text-slate-600">还没有标签</span>
              )}
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
