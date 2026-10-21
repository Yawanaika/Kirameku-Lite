"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import AdminError from "./AdminError";
import { adminRequest, describeAdminError } from "./admin-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChatterItem } from "@/server/modules/chatters/contracts";

interface ChatterEditorProps {
  chatterId?: number;
}

interface FormState {
  content: string;
  images: string;
  mood: string;
  status: string;
}

const emptyForm: FormState = {
  content: "",
  images: "",
  mood: "",
  status: "draft",
};

export default function ChatterEditor({ chatterId }: ChatterEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(chatterId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chatterId) return;
    let active = true;
    adminRequest<ChatterItem>(`/api/admin/chatters/${chatterId}`)
      .then((chatter) => {
        if (!active) return;
        setForm({
          content: chatter.content,
          images: chatter.images.join("\n"),
          mood: chatter.mood,
          status: chatter.status,
        });
      })
      .catch((reason: unknown) => {
        if (active) setError(describeAdminError(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [chatterId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.content.trim()) {
      setError("说说内容不能为空");
      return;
    }

    const body = {
      content: form.content.trim(),
      images: form.images
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      mood: form.mood.trim(),
      status: form.status,
    };

    setSaving(true);
    setError(null);
    try {
      await adminRequest(
        chatterId ? `/api/admin/chatters/${chatterId}` : "/api/admin/chatters",
        {
          method: chatterId ? "PUT" : "POST",
          body: JSON.stringify(body),
        },
      );
      router.push("/admin/chatters");
      router.refresh();
    } catch (reason) {
      setError(describeAdminError(reason));
      setSaving(false);
    }
  }

  async function remove() {
    if (!chatterId) return;
    if (!window.confirm("确定删除这条说说？关联评论会一并删除。")) return;
    setDeleting(true);
    setError(null);
    try {
      await adminRequest(`/api/admin/chatters/${chatterId}`, {
        method: "DELETE",
      });
      router.push("/admin/chatters");
      router.refresh();
    } catch (reason) {
      setError(describeAdminError(reason));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-16 text-center text-sm text-slate-500">
        正在加载说说…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/chatters"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            返回说说列表
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {chatterId ? "编辑说说" : "新建说说"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {chatterId ? `说说 ID #${chatterId}` : "支持多张图片和心情文本。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {chatterId ? (
            <Button
              variant="destructive"
              onClick={remove}
              disabled={deleting || saving}
            >
              <Trash2 className="size-4" aria-hidden />
              {deleting ? "删除中…" : "删除"}
            </Button>
          ) : null}
          <Link
            href="/admin/chatters"
            className={buttonVariants({ variant: "outline" })}
          >
            取消
          </Link>
          <Button type="submit" disabled={saving || deleting}>
            <Save className="size-4" aria-hidden />
            {saving ? "保存中…" : "保存说说"}
          </Button>
        </div>
      </header>

      {error ? <AdminError message={error} /> : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="chatter-content">内容</Label>
            <Textarea
              id="chatter-content"
              value={form.content}
              onChange={(event) => update("content", event.target.value)}
              placeholder="此刻的想法…"
              className="min-h-40"
              required
            />
            <p className="text-right text-[11px] text-slate-600 tabular-nums">
              {form.content.length} / 10000
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="chatter-mood">心情</Label>
              <Input
                id="chatter-mood"
                value={form.mood}
                onChange={(event) => update("mood", event.target.value)}
                placeholder="平静、开心…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chatter-status">状态</Label>
              <Select
                id="chatter-status"
                value={form.status}
                onChange={(event) => update("status", event.target.value)}
              >
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chatter-images">图片地址</Label>
            <Textarea
              id="chatter-images"
              value={form.images}
              onChange={(event) => update("images", event.target.value)}
              placeholder={"每行一个地址\n/images/a.webp\nhttps://example.com/b.webp"}
              className="min-h-28 font-mono text-[13px]"
            />
            <p className="text-[11px] text-slate-600">
              每行一个图片地址，最多 20 张。
            </p>
          </div>
        </div>
      </section>
    </form>
  );
}
