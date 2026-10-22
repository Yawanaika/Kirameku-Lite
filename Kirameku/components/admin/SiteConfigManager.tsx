"use client";

import { useMemo, useState } from "react";
import { Braces, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import { useConfirm } from "./ConfirmProvider";
import { adminRequest, describeAdminError } from "./admin-api";
import { formatDateTime } from "./format";
import { useAdminData } from "./use-admin-data";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SiteConfigAdminItem } from "@/server/modules/site-config/contracts";

interface FormState {
  key: string;
  value: string;
  description: string;
}

const emptyForm: FormState = { key: "", value: "", description: "" };

function valuePreview(value: string): string {
  if (!value) return "空值";
  return value.length > 160 ? `${value.slice(0, 160)}…` : value;
}

export default function SiteConfigManager() {
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const {
    data: configs,
    loading,
    error,
    reload,
  } = useAdminData<SiteConfigAdminItem[]>("/api/admin/site-config");

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return configs ?? [];
    return (configs ?? []).filter(
      (item) =>
        item.key.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword),
    );
  }, [configs, search]);

  function resetForm() {
    setForm(emptyForm);
    setEditingKey(null);
    setFormError(null);
  }

  function edit(item: SiteConfigAdminItem) {
    setEditingKey(item.key);
    setForm({
      key: item.key,
      value: item.value,
      description: item.description,
    });
    setFormError(null);
  }

  function formatJson() {
    try {
      const parsed: unknown = JSON.parse(form.value);
      setForm((current) => ({
        ...current,
        value: JSON.stringify(parsed, null, 2),
      }));
      setFormError(null);
    } catch {
      setFormError("当前值不是合法 JSON，无法格式化");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.key.trim()) {
      setFormError("配置 key 不能为空");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingKey) {
        await adminRequest(
          `/api/admin/site-config/${encodeURIComponent(editingKey)}`,
          {
            method: "PUT",
            body: JSON.stringify({
              value: form.value,
              description: form.description,
            }),
          },
        );
      } else {
        await adminRequest("/api/admin/site-config", {
          method: "POST",
          body: JSON.stringify({
            key: form.key.trim(),
            value: form.value,
            description: form.description,
          }),
        });
      }
      resetForm();
      reload();
    } catch (reason) {
      setFormError(describeAdminError(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: SiteConfigAdminItem) {
    if (!await confirm(`确定删除配置「${item.key}」？`)) return;
    setBusyKey(item.key);
    setActionError(null);
    try {
      await adminRequest(
        `/api/admin/site-config/${encodeURIComponent(item.key)}`,
        { method: "DELETE" },
      );
      if (editingKey === item.key) resetForm();
      reload();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Settings"
        title="站点配置"
        description="维护前台读取的键值配置；值可以是普通字符串或 JSON。"
        actions={
          <Button variant="outline" onClick={reload}>
            <RefreshCw className="size-4" aria-hidden />
            刷新
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>配置项</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                共 {configs?.length ?? 0} 项
              </p>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索 key 或描述"
              className="w-56"
              aria-label="搜索配置"
            />
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

          {loading && !configs ? (
            <div className="px-5 py-16 text-center text-sm text-slate-500">
              正在加载配置…
            </div>
          ) : filtered.length > 0 ? (
            <ul className="divide-y divide-white/5">
              {filtered.map((item) => (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-sky-300">
                          {item.key}
                        </code>
                        {item.description ? (
                          <span className="text-[11px] text-slate-500">
                            {item.description}
                          </span>
                        ) : null}
                      </div>
                      <pre className="mt-2 max-h-24 overflow-hidden font-mono text-[11px] leading-5 break-all whitespace-pre-wrap text-slate-500">
                        {valuePreview(item.value)}
                      </pre>
                      <p className="mt-1 text-[10px] text-slate-600">
                        更新于 {formatDateTime(item.updated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => edit(item)}
                        aria-label={`编辑 ${item.key}`}
                        title="编辑"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-rose-300"
                        disabled={busyKey === item.key}
                        onClick={() => remove(item)}
                        aria-label={`删除 ${item.key}`}
                        title="删除"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmptyState
              title={search ? "没有匹配的配置" : "还没有站点配置"}
              description={
                search
                  ? "换一个关键词试试。"
                  : "新增配置后，前台可以通过 site-config 接口读取。"
              }
            />
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <div className="flex w-full items-center justify-between">
              <CardTitle>{editingKey ? "编辑配置" : "新增配置"}</CardTitle>
              {editingKey ? (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="size-3.5" aria-hidden />
                  取消
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <form onSubmit={submit} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="config-key">Key</Label>
              <Input
                id="config-key"
                value={form.key}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    key: event.target.value,
                  }))
                }
                placeholder="site_title"
                disabled={Boolean(editingKey)}
                required
              />
              {editingKey ? (
                <p className="text-[11px] text-slate-600">key 创建后不可修改。</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="config-description">描述</Label>
              <Input
                id="config-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="可选说明"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="config-value">值</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={formatJson}
                  title="尝试格式化为 JSON"
                >
                  <Braces className="size-3.5" aria-hidden />
                  格式化
                </Button>
              </div>
              <Textarea
                id="config-value"
                value={form.value}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    value: event.target.value,
                  }))
                }
                placeholder='{"title":"Kirameku"}'
                className="min-h-44 font-mono text-[12px] leading-5"
              />
            </div>
            {formError ? <AdminError message={formError} /> : null}
            <Button type="submit" className="w-full" disabled={saving}>
              {editingKey ? (
                <Pencil className="size-4" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              {saving ? "保存中…" : editingKey ? "保存修改" : "新增配置"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
