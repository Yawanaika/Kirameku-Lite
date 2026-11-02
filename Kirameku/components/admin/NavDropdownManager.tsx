"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import { useConfirm } from "./ConfirmProvider";
import { adminRequest, describeAdminError } from "./admin-api";
import { useAdminData } from "./use-admin-data";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  isExternalHref,
  isSafeHref,
  NAV_DROPDOWN_MAX_LINKS,
  navDropdownIconLabels,
  navDropdownIconNames,
  type NavDropdownConfig,
  type NavDropdownIconName,
} from "@/lib/nav-dropdown";
import { navDropdownIcons } from "@/lib/nav-dropdown-icons";
import { cn } from "@/lib/utils";

interface DraftLink {
  label: string;
  href: string;
  description: string;
}

interface Draft {
  enabled: boolean;
  label: string;
  icon: NavDropdownIconName;
  links: DraftLink[];
}

function toDraft(config: NavDropdownConfig): Draft {
  return {
    enabled: config.enabled,
    label: config.label,
    icon: config.icon,
    links: config.links.map((link) => ({ ...link })),
  };
}

function validate(draft: Draft): string | null {
  if (!draft.label.trim()) return "菜单名称不能为空";
  if (draft.links.length > NAV_DROPDOWN_MAX_LINKS) {
    return `最多配置 ${NAV_DROPDOWN_MAX_LINKS} 个链接`;
  }
  for (const [index, link] of draft.links.entries()) {
    if (!link.label.trim()) return `第 ${index + 1} 个链接缺少名称`;
    if (!link.href.trim()) return `第 ${index + 1} 个链接缺少地址`;
    if (!isSafeHref(link.href)) {
      return `第 ${index + 1} 个链接地址无效：需要以 / 开头，或使用 http(s)://、mailto:、tel:`;
    }
  }
  return null;
}

/**
 * 外层只负责取配置；拿到后交给编辑器组件。
 * 用配置的 JSON 作为 key，配置在别处被改动时会整体重建编辑器，
 * 这样编辑器内部不需要用 effect 去同步外部数据。
 */
export default function NavDropdownManager() {
  const { data, loading, error, reload } = useAdminData<NavDropdownConfig>(
    "/api/admin/nav-dropdown",
  );

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <AdminPageHeader
          eyebrow="Navigation"
          title="导航菜单"
          description="给前台导航栏加一个可展开的下拉菜单。"
        />
        <p className="py-16 text-center text-sm text-slate-500">正在加载配置…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <AdminPageHeader
          eyebrow="Navigation"
          title="导航菜单"
          description="给前台导航栏加一个可展开的下拉菜单。"
          actions={
            <Button variant="outline" onClick={reload}>
              <RefreshCw className="size-4" aria-hidden />
              重试
            </Button>
          }
        />
        <AdminError message={error ?? "读取导航菜单配置失败"} />
      </div>
    );
  }

  return (
    <NavDropdownEditor
      key={JSON.stringify(data)}
      config={data}
      onReload={reload}
    />
  );
}

function NavDropdownEditor({
  config,
  onReload,
}: {
  config: NavDropdownConfig;
  onReload: () => void;
}) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft>(() => toDraft(config));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    setSaved(false);
  }

  function updateLink(index: number, patch: Partial<DraftLink>) {
    setDraft((current) => ({
      ...current,
      links: current.links.map((link, position) =>
        position === index ? { ...link, ...patch } : link,
      ),
    }));
    setDirty(true);
    setSaved(false);
  }

  function addLink() {
    setDraft((current) => {
      if (current.links.length >= NAV_DROPDOWN_MAX_LINKS) return current;
      return {
        ...current,
        enabled: true,
        links: [...current.links, { label: "", href: "", description: "" }],
      };
    });
    setDirty(true);
    setSaved(false);
  }

  function removeLink(index: number) {
    setDraft((current) => ({
      ...current,
      links: current.links.filter((_, position) => position !== index),
    }));
    setDirty(true);
    setSaved(false);
  }

  function moveLink(index: number, offset: -1 | 1) {
    setDraft((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.links.length) return current;
      const links = [...current.links];
      const [moved] = links.splice(index, 1);
      links.splice(target, 0, moved);
      return { ...current, links };
    });
    setDirty(true);
    setSaved(false);
  }

  async function reload() {
    if (dirty && !(await confirm("重新载入会丢弃未保存的修改，确定继续？"))) {
      return;
    }
    onReload();
  }

  async function save() {
    const message = validate(draft);
    if (message) {
      setSaveError(message);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await adminRequest("/api/admin/nav-dropdown", {
        method: "PUT",
        body: JSON.stringify({
          enabled: draft.enabled,
          label: draft.label.trim(),
          icon: draft.icon,
          links: draft.links.map((link) => ({
            label: link.label.trim(),
            href: link.href.trim(),
            description: link.description.trim(),
          })),
        }),
      });
      setSaved(true);
      setDirty(false);
    } catch (reason) {
      setSaveError(describeAdminError(reason));
    } finally {
      setSaving(false);
    }
  }

  const PreviewIcon = navDropdownIcons[draft.icon];
  const externalCount = draft.links.filter((link) => isExternalHref(link.href)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <AdminPageHeader
        eyebrow="Navigation"
        title="导航菜单"
        description="给前台导航栏加一个可展开的下拉菜单，把站外或零散的页面收进去。保存后刷新前台即可看到。"
        actions={
          <>
            <Button variant="outline" onClick={reload}>
              <RefreshCw className="size-4" aria-hidden />
              重新载入
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="size-4" aria-hidden />
              {saving ? "保存中…" : "保存"}
            </Button>
          </>
        }
      />

      {saveError ? <AdminError message={saveError} /> : null}
      {saved ? (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5 text-xs text-emerald-300">
          已保存。前台导航栏刷新页面后就会显示这个下拉菜单。
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>基础设置</CardTitle>
                <CardDescription>菜单在导航栏上的显示方式</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="nav-dropdown-enabled">启用下拉菜单</Label>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    关闭后前台导航栏不显示这个菜单，配置会保留。
                  </p>
                </div>
                <button
                  type="button"
                  id="nav-dropdown-enabled"
                  role="switch"
                  aria-checked={draft.enabled}
                  aria-label="启用下拉菜单"
                  onClick={() => update({ enabled: !draft.enabled })}
                  className={cn(
                    "relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:outline-none",
                    draft.enabled ? "bg-sky-400" : "bg-white/15",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                      draft.enabled ? "left-[22px]" : "left-0.5",
                    )}
                  />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                <div className="space-y-1.5">
                  <Label htmlFor="nav-dropdown-label">菜单名称</Label>
                  <Input
                    id="nav-dropdown-label"
                    value={draft.label}
                    maxLength={40}
                    placeholder="更多"
                    onChange={(event) => update({ label: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nav-dropdown-icon">图标</Label>
                  <Select
                    id="nav-dropdown-icon"
                    value={draft.icon}
                    onChange={(event) =>
                      update({ icon: event.target.value as NavDropdownIconName })
                    }
                  >
                    {navDropdownIconNames.map((name) => (
                      <option key={name} value={name}>
                        {navDropdownIconLabels[name]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>跳转链接</CardTitle>
                <CardDescription>
                  共 {draft.links.length} 条，站外地址自动在新标签页打开
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={addLink}
                disabled={draft.links.length >= NAV_DROPDOWN_MAX_LINKS}
              >
                <Plus className="size-3.5" aria-hidden />
                添加链接
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.links.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-slate-500">
                  还没有链接。点「添加链接」填上站外地址或站内路径。
                </p>
              ) : null}

              {draft.links.map((link, index) => (
                <div
                  key={index}
                  className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      链接 {index + 1}
                      {isExternalHref(link.href) ? (
                        <span className="flex items-center gap-0.5 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-sky-300">
                          <ExternalLink className="size-2.5" aria-hidden />
                          站外
                        </span>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`上移第 ${index + 1} 条链接`}
                        disabled={index === 0}
                        onClick={() => moveLink(index, -1)}
                      >
                        <ArrowUp className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`下移第 ${index + 1} 条链接`}
                        disabled={index === draft.links.length - 1}
                        onClick={() => moveLink(index, 1)}
                      >
                        <ArrowDown className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-rose-300"
                        aria-label={`删除第 ${index + 1} 条链接`}
                        onClick={() => removeLink(index)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`nav-link-label-${index}`}>名称</Label>
                      <Input
                        id={`nav-link-label-${index}`}
                        value={link.label}
                        maxLength={60}
                        placeholder="GitHub"
                        onChange={(event) =>
                          updateLink(index, { label: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`nav-link-href-${index}`}>地址</Label>
                      <Input
                        id={`nav-link-href-${index}`}
                        value={link.href}
                        maxLength={500}
                        placeholder="https://example.com 或 /posts"
                        onChange={(event) =>
                          updateLink(index, { href: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`nav-link-desc-${index}`}>说明（可选）</Label>
                    <Input
                      id={`nav-link-desc-${index}`}
                      value={link.description}
                      maxLength={160}
                      placeholder="悬停时显示的一行小字"
                      onChange={(event) =>
                        updateLink(index, { description: event.target.value })
                      }
                    />
                  </div>
                </div>
              ))}

              <p className="text-[11px] leading-5 text-slate-600">
                地址支持站内路径（/posts、#top）、站外链接（https://…）以及
                mailto:、tel:；javascript: 之类的协议会被拒绝。
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <div>
              <CardTitle>效果预览</CardTitle>
              <CardDescription>
                {draft.enabled ? "前台展示的样子" : "当前为关闭状态"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div
                className={cn(
                  "flex w-fit items-center gap-1.5 rounded-lg px-3 py-2 text-sm",
                  draft.enabled ? "text-slate-100" : "text-slate-600",
                )}
              >
                <PreviewIcon className="size-4" aria-hidden />
                <span>{draft.label.trim() || "更多"}</span>
                <ChevronDown className="size-3.5" aria-hidden />
              </div>

              <div className="mt-2 w-56 rounded-2xl border border-white/10 bg-slate-900/90 p-2">
                {draft.links.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-slate-600">
                    菜单里还没有条目
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {draft.links.map((link, index) => (
                      <li
                        key={index}
                        className="rounded-lg px-3 py-1.5 text-xs text-slate-300"
                      >
                        <span className="flex items-center gap-1">
                          <span className="truncate">
                            {link.label.trim() || "未命名链接"}
                          </span>
                          {isExternalHref(link.href) ? (
                            <ExternalLink
                              className="size-3 shrink-0 opacity-50"
                              aria-hidden
                            />
                          ) : null}
                        </span>
                        {link.description.trim() ? (
                          <span className="block truncate text-[10px] text-slate-500">
                            {link.description.trim()}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <dl className="space-y-1.5 text-[11px] text-slate-500">
              <div className="flex items-center justify-between">
                <dt>链接数量</dt>
                <dd className="text-slate-300">{draft.links.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>其中站外链接</dt>
                <dd className="text-slate-300">{externalCount}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>未保存的修改</dt>
                <dd className={dirty ? "text-amber-300" : "text-slate-600"}>
                  {dirty ? "有" : "无"}
                </dd>
              </div>
            </dl>

            <p className="text-[11px] leading-5 text-slate-600">
              配置保存在站点配置的 nav_dropdown 键里，也可以在「站点配置」页查看这段
              JSON。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
