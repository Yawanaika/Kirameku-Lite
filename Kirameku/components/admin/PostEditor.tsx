"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Columns2,
  Eye,
  Loader2,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import AdminError from "./AdminError";
import ImageUploader from "./ImageUploader";
import MarkdownEditor from "./MarkdownEditor";
import { useConfirm } from "./ConfirmProvider";
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
  PostSnapshot,
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
  scheduledAt: string;
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
  scheduledAt: "",
  isPinned: false,
};

const viewModes = [
  { value: "editor", label: "编辑", icon: Pencil },
  { value: "split", label: "分栏", icon: Columns2 },
  { value: "preview", label: "预览", icon: Eye },
] as const;

type ViewMode = (typeof viewModes)[number]["value"];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toLocalDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
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
  const confirm = useConfirm();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [activePostId, setActivePostId] = useState<number | null>(postId ?? null);
  const activePostIdRef = useRef<number | null>(postId ?? null);
  const autoSavePromiseRef = useRef<Promise<unknown> | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState("尚未保存");
  const [revisions, setRevisions] = useState<{ id: number; created_at: string; snapshot: PostSnapshot }[]>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(postId));
  const [loadingPost, setLoadingPost] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: categories } = useAdminData<CategoryItem[]>(
    "/api/admin/categories",
  );
  const { data: tags } = useAdminData<TagItem[]>("/api/admin/tags");

  useEffect(() => {
    if (!postId) return;
    let active = true;
    adminRequest<PostDetail>(`/api/admin/posts/${postId}`)
      .then(async (post) => {
        if (!active) return;
        setCategoryName(post.category);
        const draft = await adminRequest<PostSnapshot | null>(`/api/admin/posts/${postId}/draft`);
        if (!active) return;
        const source = draft ?? {
          title: post.title, slug: post.slug, description: post.description,
          content: post.content, cover: post.cover, category_id: post.category_id,
          tags: post.tags, status: post.status, scheduled_at: post.scheduled_at,
          is_pinned: post.is_pinned,
        };
        setForm({
          title: source.title, slug: source.slug, description: source.description,
          content: source.content, cover: source.cover,
          categoryId: source.category_id ? String(source.category_id) : "",
          tags: source.tags.join(", "), status: source.status,
          scheduledAt: toLocalDateTime(source.scheduled_at),
          isPinned: source.is_pinned,
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

  useEffect(() => {
    if (!activePostId) return;
    let active = true;
    adminRequest<typeof revisions>(`/api/admin/posts/${activePostId}/revisions`)
      .then((items) => { if (active) setRevisions(items); })
      .catch(() => {});
    return () => { active = false; };
  }, [activePostId]);

  useEffect(() => {
    if (loadingPost || saving || !form.title.trim() || !form.slug.trim()) return;
    const timer = window.setTimeout(() => {
      setAutoSaveStatus("正在自动保存…");
      const snapshot: PostSnapshot = {
        title: form.title.trim(), slug: form.slug.trim(), description: form.description,
        content: form.content, cover: form.cover.trim(),
        category_id: selectedCategoryId ? Number(selectedCategoryId) : null,
        tags: splitTags(form.tags), status: form.status as PostSnapshot["status"],
        scheduled_at: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        is_pinned: form.isPinned,
      };
      const request = (autoSavePromiseRef.current ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => {
          const currentPostId = activePostIdRef.current;
          const url = currentPostId ? `/api/admin/posts/${currentPostId}/draft` : "/api/admin/posts/draft";
          return adminRequest<{ post_id: number }>(url, {
            method: currentPostId ? "PUT" : "POST", body: JSON.stringify(snapshot),
          });
        });
      autoSavePromiseRef.current = request;
      request.then((result) => {
        activePostIdRef.current = result.post_id;
        setActivePostId(result.post_id);
        setAutoSaveStatus(`已自动保存 ${new Date().toLocaleTimeString()}`);
      }).catch((reason: unknown) => {
        setAutoSaveStatus(`自动保存失败：${describeAdminError(reason)}`);
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [form, activePostId, loadingPost, saving, selectedCategoryId]);

  useEffect(() => {
    if (viewMode === "editor") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      adminRequest<{ html: string }>("/api/admin/markdown/preview", {
        method: "POST",
        body: JSON.stringify({ content: form.content }),
        signal: controller.signal,
      })
        .then((data) => {
          if (controller.signal.aborted) return;
          setPreviewHtml(data.html);
          setPreviewError(null);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setPreviewError(describeAdminError(reason));
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewLoading(false);
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.content, viewMode]);

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
      scheduled_at: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      is_pinned: form.isPinned,
    };

    setSaving(true);
    setError(null);
    try {
      await autoSavePromiseRef.current?.catch(() => undefined);
      const currentPostId = activePostIdRef.current;
      if (currentPostId) {
        await adminRequest(`/api/admin/posts/${currentPostId}`, {
          method: "PUT", body: JSON.stringify(body),
        });
      } else {
        await adminRequest("/api/admin/posts", { method: "POST", body: JSON.stringify(body) });
      }
      router.push("/admin/posts");
      router.refresh();
    } catch (reason) {
      setError(describeAdminError(reason));
      setSaving(false);
    }
  }

  async function restoreRevision() {
    if (!activePostId || !selectedRevisionId) return;
    try {
      const snapshot = await adminRequest<PostSnapshot>(`/api/admin/posts/${activePostId}/revisions/${selectedRevisionId}/restore`, { method: "POST" });
      setCategoryName("");
      setForm({
        title: snapshot.title, slug: snapshot.slug, description: snapshot.description,
        content: snapshot.content, cover: snapshot.cover,
        categoryId: snapshot.category_id ? String(snapshot.category_id) : "",
        tags: snapshot.tags.join(", "), status: snapshot.status,
        scheduledAt: toLocalDateTime(snapshot.scheduled_at), isPinned: snapshot.is_pinned,
      });
      setAutoSaveStatus("已恢复到编辑草稿，可检查后再保存发布");
    } catch (reason) {
      setError(describeAdminError(reason));
    }
  }

  async function remove() {
    if (!activePostId) return;
    if (!await confirm("确定删除这篇文章？此操作不可撤销。")) return;
    setDeleting(true);
    setError(null);
    try {
      await adminRequest(`/api/admin/posts/${activePostId}`, { method: "DELETE" });
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
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            返回文章列表
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {postId ? "编辑文章" : "新建文章"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {postId ? `文章 ID #${postId}` : "正文支持 Markdown，保存后可继续编辑。"}
          </p>
          <p className="mt-1 text-xs text-slate-500" aria-live="polite">{autoSaveStatus}</p>
        </div>
        <div className="flex items-center gap-2">
          {activePostId ? (
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
          <Button type="button" variant="outline" onClick={() => setViewMode("preview")}>发布前预览</Button>
          <Button type="submit" disabled={saving || deleting}>
            <Save className="size-4" aria-hidden />
            {saving ? "保存中…" : "保存文章"}
          </Button>
        </div>
      </header>

      {error ? <AdminError message={error} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.035] p-5">
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

          <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.035] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Label htmlFor="post-content">正文（Markdown）</Label>
                <span className="text-[11px] text-slate-600 tabular-nums">
                  {wordCount} 字符 · 约 {readingTime} 分钟
                </span>
              </div>
              <div
                role="group"
                aria-label="编辑视图"
                className="flex items-center rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-950/40 p-0.5"
              >
                {viewModes.map((mode) => {
                  const Icon = mode.icon;
                  const active = viewMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setViewMode(mode.value)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                        active
                          ? "bg-slate-900/[0.06] dark:bg-white/10 text-slate-900 dark:text-white"
                          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className={
                viewMode === "split"
                  ? "grid gap-3 xl:grid-cols-2"
                  : undefined
              }
            >
              <div className={viewMode === "preview" ? "hidden" : undefined}>
                <MarkdownEditor
                  id="post-content"
                  value={form.content}
                  onChange={(value) => update("content", value)}
                />
              </div>

              {viewMode !== "editor" ? (
                <div className="h-[420px] overflow-y-auto rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-950/60 p-5">
                  <div className="mb-3 flex items-center justify-between text-[11px] text-slate-600">
                    <span>预览</span>
                    {previewLoading ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        更新中…
                      </span>
                    ) : null}
                  </div>
                  {previewError ? (
                    <AdminError message={previewError} />
                  ) : previewHtml ? (
                    <div
                      className="prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <p className="text-xs text-slate-600">
                      {previewLoading ? "正在渲染预览…" : "正文为空"}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.035] p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">发布设置</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="post-status">状态</Label>
                <Select
                  id="post-status"
                  value={form.status}
                  onChange={(event) => update("status", event.target.value)}
                >
                  <option value="draft">草稿</option>
                  <option value="pending">待审核</option>
                  <option value="scheduled">计划发布</option>
                  <option value="published">已发布</option>
                  <option value="archived">已归档</option>
                  <option value="unpublish_scheduled">计划下线</option>
                </Select>
              </div>
              {form.status === "scheduled" || form.status === "unpublish_scheduled" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="post-scheduled-at">执行时间</Label>
                  <Input id="post-scheduled-at" type="datetime-local" value={form.scheduledAt} onChange={(event) => update("scheduledAt", event.target.value)} required />
                </div>
              ) : null}
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
              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) => update("isPinned", event.target.checked)}
                  className="size-3.5 rounded border-slate-300/80 dark:border-white/20 bg-slate-950 accent-sky-400"
                />
                置顶文章
              </label>
            </div>
          </section>

          {activePostId ? (
            <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.035] p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">版本历史</h2>
              <div className="mt-3 space-y-3">
                <Select value={selectedRevisionId} onChange={(event) => setSelectedRevisionId(event.target.value)}>
                  <option value="">选择历史版本进行比较</option>
                  {revisions.map((revision) => <option key={revision.id} value={revision.id}>{new Date(revision.created_at).toLocaleString()} · {revision.snapshot.title}</option>)}
                </Select>
                {selectedRevisionId ? (() => {
                  const selected = revisions.find((revision) => String(revision.id) === selectedRevisionId)?.snapshot;
                  return selected ? (
                    <div className="space-y-2 text-xs">
                      <p className="font-medium">标题：{selected.title}</p>
                      <p className="text-slate-500">当前正文：{form.content.length} 字符 · 历史正文：{selected.content.length} 字符</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950/40 p-3"><strong>当前</strong>{"\n"}{form.content}</pre>
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950/40 p-3"><strong>历史</strong>{"\n"}{selected.content}</pre>
                      </div>
                      <Button type="button" variant="outline" onClick={restoreRevision}>恢复到编辑草稿</Button>
                    </div>
                  ) : null;
                })() : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.035] p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">封面</h2>
            <div className="mt-4">
              <ImageUploader
                id="post-cover"
                label="封面图片"
                value={form.cover}
                onChange={(url) => update("cover", url)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.035] p-5 text-xs text-slate-500">
            <p className="font-medium text-slate-600 dark:text-slate-300">已有标签</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(tags ?? []).length > 0 ? (
                (tags ?? []).map((item) => (
                  <span
                    key={item.id}
                    className="rounded bg-slate-900/[0.04] dark:bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500"
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
