/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Images, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import { useConfirm } from "./ConfirmProvider";
import { adminRequest, describeAdminError } from "./admin-api";
import { formatDateTime } from "./format";
import { useAdminData } from "./use-admin-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AlbumItem } from "@/server/modules/albums/contracts";

interface FormState {
  title: string;
  description: string;
  cover: string;
  sort: string;
}

const emptyForm: FormState = {
  title: "",
  description: "",
  cover: "",
  sort: "0",
};

export default function AlbumsManager() {
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: albums,
    loading,
    error,
    reload,
  } = useAdminData<AlbumItem[]>("/api/admin/albums");

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
  }

  function edit(item: AlbumItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      cover: item.cover,
      sort: String(item.sort),
    });
    setFormError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setFormError("相册标题不能为空");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await adminRequest(
        editingId ? `/api/admin/albums/${editingId}` : "/api/admin/albums",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description,
            cover: form.cover.trim(),
            sort: Number(form.sort) || 0,
          }),
        },
      );
      resetForm();
      reload();
    } catch (reason) {
      setFormError(describeAdminError(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: AlbumItem) {
    if (
      !await confirm(
        `确定删除相册「${item.title}」？相册内的照片记录也会一并删除。`,
      )
    ) {
      return;
    }
    setBusyId(item.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/albums/${item.id}`, {
        method: "DELETE",
      });
      if (editingId === item.id) resetForm();
      reload();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Media"
        title="相册"
        description="管理相册元数据和照片记录。图片上传仍依赖旧服务，当前可先填写图片 URL。"
        actions={
          <Button variant="outline" onClick={reload}>
            <RefreshCw className="size-4" aria-hidden />
            刷新
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>全部相册</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                共 {albums?.length ?? 0} 个
              </p>
            </div>
          </CardHeader>

          {actionError ? (
            <div className="px-5 pt-4">
              <AdminError message={actionError} />
            </div>
          ) : null}
          {error ? (
            <div className="px-5 pt-4">
              <AdminError message={error} />
            </div>
          ) : null}

          {loading && !albums ? (
            <div className="px-5 py-16 text-center text-sm text-slate-500">
              正在加载相册…
            </div>
          ) : albums && albums.length > 0 ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {albums.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40"
                >
                  <div className="relative h-32 bg-white/[0.03]">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-slate-700">
                        <Images className="size-8" aria-hidden />
                      </div>
                    )}
                    <span className="absolute top-2 right-2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[10px] text-slate-300">
                      {item.photo_count} 张
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {item.title}
                    </p>
                    <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-slate-500">
                      {item.description || "无描述"}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      排序 {item.sort} · {formatDateTime(item.updated_at)}
                    </p>
                    <div className="mt-3 flex items-center gap-1.5">
                      <Link
                        href={`/admin/albums/${item.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        管理照片
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => edit(item)}
                        aria-label={`编辑 ${item.title}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-rose-300"
                        disabled={busyId === item.id}
                        onClick={() => remove(item)}
                        aria-label={`删除 ${item.title}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <AdminEmptyState
              title="还没有相册"
              description="创建相册后，可以在相册详情里添加照片 URL。"
            />
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <div className="flex w-full items-center justify-between">
              <CardTitle>{editingId ? "编辑相册" : "新建相册"}</CardTitle>
              {editingId ? (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="size-3.5" aria-hidden />
                  取消
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <form onSubmit={submit} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="album-title">标题</Label>
              <Input
                id="album-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="album-description">描述</Label>
              <Textarea
                id="album-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="album-cover">封面地址</Label>
              <Input
                id="album-cover"
                value={form.cover}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cover: event.target.value,
                  }))
                }
                placeholder="/images/albums/cover.webp"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="album-sort">排序</Label>
              <Input
                id="album-sort"
                type="number"
                value={form.sort}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sort: event.target.value,
                  }))
                }
              />
            </div>
            {formError ? <AdminError message={formError} /> : null}
            <Button type="submit" className="w-full" disabled={saving}>
              {editingId ? (
                <Pencil className="size-4" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              {saving ? "保存中…" : editingId ? "保存修改" : "新建相册"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
