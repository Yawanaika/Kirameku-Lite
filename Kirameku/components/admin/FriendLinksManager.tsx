"use client";

import { useState } from "react";
import {
  Check,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import StatusBadge from "./StatusBadge";
import { useConfirm } from "./ConfirmProvider";
import { adminRequest, describeAdminError } from "./admin-api";
import { formatDateTime } from "./format";
import { useAdminData } from "./use-admin-data";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FriendLinkItem } from "@/server/modules/friend-links/contracts";

interface FormState {
  name: string;
  url: string;
  avatar: string;
  description: string;
  sort: string;
  isApproved: boolean;
}

const emptyForm: FormState = {
  name: "",
  url: "",
  avatar: "",
  description: "",
  sort: "0",
  isApproved: false,
};

export default function FriendLinksManager() {
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: links,
    loading,
    error,
    reload,
  } = useAdminData<FriendLinkItem[]>("/api/admin/friend-links");

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
  }

  function edit(item: FriendLinkItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      url: item.url,
      avatar: item.avatar,
      description: item.description,
      sort: String(item.sort),
      isApproved: item.is_approved,
    });
    setFormError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      setFormError("站点名称和 URL 不能为空");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await adminRequest(
        editingId
          ? `/api/admin/friend-links/${editingId}`
          : "/api/admin/friend-links",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            url: form.url.trim(),
            avatar: form.avatar.trim(),
            description: form.description,
            sort: Number(form.sort) || 0,
            is_approved: form.isApproved,
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

  async function toggleApproved(item: FriendLinkItem) {
    setMutatingId(item.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/friend-links/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_approved: !item.is_approved }),
      });
      reload();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setMutatingId(null);
    }
  }

  async function remove(item: FriendLinkItem) {
    if (!await confirm(`确定删除友链「${item.name}」？`)) return;
    setMutatingId(item.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/friend-links/${item.id}`, {
        method: "DELETE",
      });
      if (editingId === item.id) resetForm();
      reload();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setMutatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Community"
        title="友链"
        description="审核和排序友链；只有已审核友链会出现在前台漂流瓶页面。"
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
              <CardTitle>全部友链</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                共 {links?.length ?? 0} 条
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

          {loading && !links ? (
            <div className="px-5 py-16 text-center text-sm text-slate-500">
              正在加载友链…
            </div>
          ) : links && links.length > 0 ? (
            <ul className="divide-y divide-white/5">
              {links.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-200">
                        {item.name}
                      </p>
                      <StatusBadge
                        status={item.is_approved ? "approved" : "pending"}
                        label={item.is_approved ? "已审核" : "待审核"}
                      />
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-300"
                      >
                        {item.url}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {item.description || "无描述"}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      排序 {item.sort} · 更新于 {formatDateTime(item.updated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={mutatingId === item.id}
                      onClick={() => toggleApproved(item)}
                    >
                      {item.is_approved ? (
                        <X className="size-3.5 text-rose-300" aria-hidden />
                      ) : (
                        <Check className="size-3.5 text-emerald-300" aria-hidden />
                      )}
                      {item.is_approved ? "取消审核" : "通过"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => edit(item)}
                      aria-label={`编辑 ${item.name}`}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-500 hover:text-rose-300"
                      disabled={mutatingId === item.id}
                      onClick={() => remove(item)}
                      aria-label={`删除 ${item.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmptyState title="还没有友链" description="添加第一条友链。" />
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <div className="flex w-full items-center justify-between">
              <CardTitle>{editingId ? "编辑友链" : "新建友链"}</CardTitle>
              {editingId ? (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  取消
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <form onSubmit={submit} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="friend-name">站点名称</Label>
              <Input
                id="friend-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="friend-url">URL</Label>
              <Input
                id="friend-url"
                value={form.url}
                onChange={(event) =>
                  setForm((current) => ({ ...current, url: event.target.value }))
                }
                placeholder="https://example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="friend-avatar">头像地址</Label>
              <Input
                id="friend-avatar"
                value={form.avatar}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    avatar: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="friend-description">描述</Label>
              <Textarea
                id="friend-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="friend-sort">排序</Label>
              <Input
                id="friend-sort"
                type="number"
                value={form.sort}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sort: event.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={form.isApproved}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isApproved: event.target.checked,
                  }))
                }
                className="size-3.5 rounded border-white/20 bg-slate-950 accent-sky-400"
              />
              审核通过（前台可见）
            </label>
            {formError ? <AdminError message={formError} /> : null}
            <Button type="submit" className="w-full" disabled={saving}>
              {editingId ? (
                <Pencil className="size-4" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              {saving ? "保存中…" : editingId ? "保存修改" : "添加友链"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
