"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ImagePlus,
  Layers,
  Music,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Trash2,
  TriangleAlert,
  UserRound,
  Wand2,
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
import { Textarea } from "@/components/ui/textarea";
import {
  isSafeAssetUrl,
  isSafeSettingsLink,
  SITE_SETTINGS_LIMITS,
  type SiteSettings,
  type SiteShareCard,
} from "@/lib/site-settings";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "profile", label: "基本信息", icon: UserRound },
  { id: "appearance", label: "外观背景", icon: Palette },
  { id: "share", label: "分享卡片", icon: Share2 },
  { id: "content", label: "内容与页脚", icon: Layers },
  { id: "music", label: "云音乐", icon: Music },
] as const;

type TabId = (typeof TABS)[number]["id"];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const HEX_COLOR_6 = /^#[0-9a-f]{6}$/i;
const BADGE_COLOR = /^[a-z0-9 /:-]*$/i;
const TRACK_ID = /^\d+$/;

function toDraft(settings: SiteSettings): SiteSettings {
  return {
    profile: { ...settings.profile, social: { ...settings.profile.social } },
    appearance: {
      ...settings.appearance,
      themeColors: [...settings.appearance.themeColors],
      bgImages: [...settings.appearance.bgImages],
    },
    share: { ...settings.share },
    content: {
      ...settings.content,
      footerBadges: settings.content.footerBadges.map((badge) => ({ ...badge })),
      icp: { ...settings.content.icp },
      moeIcp: { ...settings.content.moeIcp },
    },
    music: { ...settings.music, trackIds: [...settings.music.trackIds] },
  };
}

/** 与服务端 zod 校验保持一致，先在前端拦一遍，避免无谓的请求。 */
function validate(settings: SiteSettings): string | null {
  const { profile, appearance, share, content, music } = settings;

  if (!profile.siteTitle.trim()) return "站点标题不能为空";
  if (profile.siteTitle.trim().length > SITE_SETTINGS_LIMITS.siteTitle) {
    return "站点标题最多 " + SITE_SETTINGS_LIMITS.siteTitle + " 个字符";
  }
  if (!profile.authorName.trim()) return "昵称不能为空";
  if (profile.authorName.trim().length > SITE_SETTINGS_LIMITS.authorName) {
    return "昵称最多 " + SITE_SETTINGS_LIMITS.authorName + " 个字符";
  }
  if (profile.bio.length > SITE_SETTINGS_LIMITS.bio) {
    return "简介最多 " + SITE_SETTINGS_LIMITS.bio + " 个字符";
  }
  if (!isSafeAssetUrl(profile.avatarUrl)) {
    return "头像地址需要以 / 开头，或使用 http(s):// 绝对地址";
  }
  if (!profile.buildDate.trim()) return "建站时间不能为空";
  if (!isSafeSettingsLink(profile.social.github)) {
    return "GitHub 地址需要留空、以 / 开头，或使用 http(s)://";
  }
  if (!isSafeSettingsLink(profile.social.tg)) {
    return "Telegram 地址需要留空、以 / 开头，或使用 http(s)://";
  }

  if (appearance.themeColors.length < 2) return "至少需要 2 个渐变颜色";
  for (const [index, color] of appearance.themeColors.entries()) {
    if (!HEX_COLOR.test(color.trim())) {
      return "第 " + (index + 1) + " 个颜色需要写成 #a18cd1 这样的十六进制";
    }
  }
  if (appearance.bgImages.length < 1) return "至少需要 1 张背景图";
  for (const [index, image] of appearance.bgImages.entries()) {
    if (!isSafeAssetUrl(image)) {
      return "第 " + (index + 1) + " 张背景图地址需要以 / 开头，或使用 http(s)://";
    }
  }
  if (!isSafeAssetUrl(appearance.defaultPostCover)) {
    return "默认封面地址需要以 / 开头，或使用 http(s)://";
  }
  if (!isSafeAssetUrl(share.image)) {
    return "分享图片地址需要以 / 开头，或使用 http(s)://";
  }

  if (!content.chatterTitle.trim()) return "留言板标题不能为空";
  if (content.chatterDescription.length > SITE_SETTINGS_LIMITS.chatterDescription) {
    return "留言板描述最多 " + SITE_SETTINGS_LIMITS.chatterDescription + " 个字符";
  }
  for (const [index, badge] of content.footerBadges.entries()) {
    if (!badge.name.trim()) return "第 " + (index + 1) + " 个徽标缺少名称";
    if (!BADGE_COLOR.test(badge.color)) {
      return "第 " + (index + 1) + " 个徽标的颜色请填写 Tailwind 类名，例如 text-sky-500";
    }
  }
  if (!isSafeSettingsLink(content.icp.link)) {
    return "备案链接需要留空、以 / 开头，或使用 http(s)://";
  }
  if (!isSafeSettingsLink(content.moeIcp.link)) {
    return "萌备案链接需要留空、以 / 开头，或使用 http(s)://";
  }

  for (const [index, id] of music.trackIds.entries()) {
    if (!TRACK_ID.test(id.trim())) {
      return "第 " + (index + 1) + " 首歌的 ID 只能是数字";
    }
  }

  return null;
}

function safeColorInput(value: string): string {
  return HEX_COLOR_6.test(value.trim()) ? value.trim() : "#a18cd1";
}

function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id?: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Thumb({ src, className }: { src: string; className?: string }) {
  const safe = isSafeAssetUrl(src) ? src.trim() : "";
  return (
    <span
      aria-hidden
      className={cn(
        "size-10 shrink-0 rounded-lg border border-slate-200/80 bg-slate-900/[0.04] bg-cover bg-center dark:border-white/10 dark:bg-white/5",
        className,
      )}
      style={safe ? { backgroundImage: "url(" + safe + ")" } : undefined}
    />
  );
}

/**
 * 外层只负责取配置；拿到后交给编辑器。
 * 用配置的 JSON 作为 key，保存或外部更新后整体重建编辑器，
 * 这样编辑器内部不需要 effect 去同步外部数据。
 */
export default function SiteSettingsManager() {
  const { data, loading, error, reload } = useAdminData<SiteSettings>(
    "/api/admin/site-settings",
  );
  const [notice, setNotice] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <AdminPageHeader
          eyebrow="Settings"
          title="站点设置"
          description="站点信息、外观背景、分享卡片、页脚与云音乐都在这里配置。"
        />
        <p className="py-16 text-center text-sm text-slate-500">正在加载设置…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <AdminPageHeader
          eyebrow="Settings"
          title="站点设置"
          description="站点信息、外观背景、分享卡片、页脚与云音乐都在这里配置。"
          actions={
            <Button variant="outline" onClick={reload}>
              <RefreshCw className="size-4" aria-hidden />
              重试
            </Button>
          }
        />
        <AdminError message={error ?? "读取站点设置失败"} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
        >
          <CheckCircle2 className="size-4" aria-hidden />
          {notice}
        </div>
      ) : null}
      <SiteSettingsEditor
        key={JSON.stringify(data)}
        settings={data}
        onReload={reload}
        onSaved={setNotice}
      />
    </div>
  );
}

function SiteSettingsEditor({
  settings,
  onReload,
  onSaved,
}: {
  settings: SiteSettings;
  onReload: () => void;
  onSaved: (message: string) => void;
}) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState<SiteSettings>(() => toDraft(settings));
  const [tab, setTab] = useState<TabId>("profile");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  function updateProfile(patch: Partial<SiteSettings["profile"]>) {
    setDraft((current) => ({
      ...current,
      profile: { ...current.profile, ...patch },
    }));
  }

  function updateSocial(patch: Partial<SiteSettings["profile"]["social"]>) {
    setDraft((current) => ({
      ...current,
      profile: { ...current.profile, social: { ...current.profile.social, ...patch } },
    }));
  }

  function updateAppearance(patch: Partial<SiteSettings["appearance"]>) {
    setDraft((current) => ({
      ...current,
      appearance: { ...current.appearance, ...patch },
    }));
  }

  function updateShare(patch: Partial<SiteSettings["share"]>) {
    setDraft((current) => ({ ...current, share: { ...current.share, ...patch } }));
  }

  function updateContent(patch: Partial<SiteSettings["content"]>) {
    setDraft((current) => ({
      ...current,
      content: { ...current.content, ...patch },
    }));
  }

  function updateMusic(patch: Partial<SiteSettings["music"]>) {
    setDraft((current) => ({ ...current, music: { ...current.music, ...patch } }));
  }

  function moveImage(from: number, to: number) {
    setDraft((current) => {
      const images = [...current.appearance.bgImages];
      if (to < 0 || to >= images.length) return current;
      const [item] = images.splice(from, 1);
      images.splice(to, 0, item);
      return { ...current, appearance: { ...current.appearance, bgImages: images } };
    });
  }

  async function save() {
    const message = validate(draft);
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminRequest<SiteSettings>("/api/admin/site-settings", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      onSaved("设置已保存，前台会在下次渲染时生效。");
      onReload();
    } catch (reason) {
      setError(describeAdminError(reason));
    } finally {
      setSaving(false);
    }
  }

  async function discard() {
    if (dirty && !(await confirm("放弃当前未保存的修改？"))) return;
    setDraft(toDraft(settings));
    setError(null);
    onSaved("");
    onReload();
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Settings"
        title="站点设置"
        description="站点信息、外观背景、分享卡片、页脚与云音乐都在这里配置；保存后前台立即读取新值。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={discard} disabled={saving}>
              <RefreshCw className="size-4" aria-hidden />
              重新载入
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              <Save className="size-4" aria-hidden />
              {saving ? "保存中…" : "保存设置"}
            </Button>
          </div>
        }
      />

      {dirty ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
          <TriangleAlert className="size-3.5" aria-hidden />
          有未保存的修改。
        </div>
      ) : null}

      <nav aria-label="设置分组" className="flex flex-wrap gap-1.5">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-sky-500/10 text-sky-700 dark:bg-white/10 dark:text-white"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </nav>

      {tab === "profile" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="站点标识" description="浏览器标题、分享卡片与后台顶部都会用到。">
            <Field
              id="site-title"
              label="站点标题"
              hint={"最多 " + SITE_SETTINGS_LIMITS.siteTitle + " 个字符"}
            >
              <Input
                id="site-title"
                value={draft.profile.siteTitle}
                maxLength={SITE_SETTINGS_LIMITS.siteTitle}
                onChange={(event) => updateProfile({ siteTitle: event.target.value })}
              />
            </Field>
            <Field
              id="author-name"
              label="昵称"
              hint="显示在导航栏 logo、关于页与 RSS 作者。"
            >
              <Input
                id="author-name"
                value={draft.profile.authorName}
                maxLength={SITE_SETTINGS_LIMITS.authorName}
                onChange={(event) => updateProfile({ authorName: event.target.value })}
              />
            </Field>
            <Field id="build-date" label="建站时间" hint="用于计算站点运行天数，形如 2026-10-22T12:00:00">
              <Input
                id="build-date"
                type="datetime-local"
                value={draft.profile.buildDate}
                onChange={(event) => updateProfile({ buildDate: event.target.value })}
              />
            </Field>
            <Field
              id="bio"
              label="简介"
              hint={"最多 " + SITE_SETTINGS_LIMITS.bio + " 个字符"}
            >
              <Textarea
                id="bio"
                value={draft.profile.bio}
                maxLength={SITE_SETTINGS_LIMITS.bio}
                className="min-h-20"
                onChange={(event) => updateProfile({ bio: event.target.value })}
              />
            </Field>
          </Section>

          <Section title="头像与社交" description="头像支持站内路径或完整 http(s) 地址。">
            <div className="flex items-start gap-3">
              <Thumb src={draft.profile.avatarUrl} className="size-16 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="avatar-url">头像地址</Label>
                <Input
                  id="avatar-url"
                  value={draft.profile.avatarUrl}
                  maxLength={SITE_SETTINGS_LIMITS.image}
                  placeholder="/images/avatar.jpg"
                  onChange={(event) => updateProfile({ avatarUrl: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="social-github" label="GitHub">
                <Input
                  id="social-github"
                  value={draft.profile.social.github}
                  placeholder="https://github.com/yourname"
                  onChange={(event) => updateSocial({ github: event.target.value })}
                />
              </Field>
              <Field id="social-tg" label="Telegram">
                <Input
                  id="social-tg"
                  value={draft.profile.social.tg}
                  placeholder="https://t.me/yourname"
                  onChange={(event) => updateSocial({ tg: event.target.value })}
                />
              </Field>
              <Field id="social-email" label="邮箱">
                <Input
                  id="social-email"
                  value={draft.profile.social.email}
                  onChange={(event) => updateSocial({ email: event.target.value })}
                />
              </Field>
              <Field id="social-wechat" label="微信">
                <Input
                  id="social-wechat"
                  value={draft.profile.social.wechat}
                  onChange={(event) => updateSocial({ wechat: event.target.value })}
                />
              </Field>
            </div>
          </Section>
        </div>
      ) : null}

      {tab === "appearance" ? (
        <div className="space-y-5">
          <Section
            title="主题渐变"
            description="控制站点主色渐变与背景叠层。"
            action={
              <Button
                variant="outline"
                size="sm"
                disabled={draft.appearance.themeColors.length >= SITE_SETTINGS_LIMITS.themeColors}
                onClick={() =>
                  updateAppearance({
                    themeColors: [...draft.appearance.themeColors, "#a18cd1"],
                  })
                }
              >
                <Plus className="size-3.5" aria-hidden />
                添加颜色
              </Button>
            }
          >
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/50 px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]">
              <span className="text-slate-700 dark:text-slate-200">使用渐变主题</span>
              <button
                type="button"
                role="switch"
                aria-checked={draft.appearance.useGradient}
                aria-label="使用渐变主题"
                onClick={() => updateAppearance({ useGradient: !draft.appearance.useGradient })}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition",
                  draft.appearance.useGradient
                    ? "bg-sky-500 dark:bg-sky-400"
                    : "bg-slate-300 dark:bg-white/15",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all",
                    draft.appearance.useGradient ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
            </label>

            <div className="space-y-2">
              {draft.appearance.themeColors.map((color, index) => (
                <div key={"color-" + index} className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={"第 " + (index + 1) + " 个颜色"}
                    value={safeColorInput(color)}
                    onChange={(event) => {
                      const next = [...draft.appearance.themeColors];
                      next[index] = event.target.value;
                      updateAppearance({ themeColors: next });
                    }}
                    className="size-9 shrink-0 cursor-pointer rounded-lg border border-slate-200/80 bg-transparent dark:border-white/10"
                  />
                  <Input
                    value={color}
                    onChange={(event) => {
                      const next = [...draft.appearance.themeColors];
                      next[index] = event.target.value;
                      updateAppearance({ themeColors: next });
                    }}
                    placeholder="#a18cd1"
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={"删除第 " + (index + 1) + " 个颜色"}
                    disabled={draft.appearance.themeColors.length <= 2}
                    onClick={() => {
                      const next = draft.appearance.themeColors.filter(
                        (_, i) => i !== index,
                      );
                      updateAppearance({ themeColors: next });
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-500">
              至少保留 2 个颜色，最多 {SITE_SETTINGS_LIMITS.themeColors} 个；支持 #rgb 与 #rrggbb。
            </p>
          </Section>

          <Section
            title="背景图"
            description="首页背景轮播与设置面板里的可选图片。"
            action={
              <Button
                variant="outline"
                size="sm"
                disabled={draft.appearance.bgImages.length >= SITE_SETTINGS_LIMITS.bgImages}
                onClick={() =>
                  updateAppearance({ bgImages: [...draft.appearance.bgImages, ""] })
                }
              >
                <ImagePlus className="size-3.5" aria-hidden />
                添加背景图
              </Button>
            }
          >
            <div className="space-y-2">
              {draft.appearance.bgImages.map((image, index) => (
                <div key={"bg-" + index} className="flex items-center gap-2">
                  <Thumb src={image} />
                  <Input
                    value={image}
                    aria-label={"第 " + (index + 1) + " 张背景图"}
                    placeholder="/images/1.webp"
                    onChange={(event) => {
                      const next = [...draft.appearance.bgImages];
                      next[index] = event.target.value;
                      updateAppearance({ bgImages: next });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="上移"
                    disabled={index === 0}
                    onClick={() => moveImage(index, index - 1)}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="下移"
                    disabled={index === draft.appearance.bgImages.length - 1}
                    onClick={() => moveImage(index, index + 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="删除背景图"
                    disabled={draft.appearance.bgImages.length <= 1}
                    onClick={() => {
                      const next = draft.appearance.bgImages.filter(
                        (_, i) => i !== index,
                      );
                      updateAppearance({ bgImages: next });
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-500">
              第一张是默认背景；至少保留 1 张，最多 {SITE_SETTINGS_LIMITS.bgImages} 张。
            </p>
          </Section>

          <Section title="默认图片" description="文章未设置封面时使用的兜底图片。">
            <div className="space-y-1.5">
              <Label htmlFor="default-cover">默认文章封面</Label>
              <div className="flex items-center gap-2">
                <Thumb src={draft.appearance.defaultPostCover} />
                <Input
                  id="default-cover"
                  value={draft.appearance.defaultPostCover}
                  placeholder="/images/default-cover.jpg"
                  onChange={(event) =>
                    updateAppearance({ defaultPostCover: event.target.value })
                  }
                />
              </div>
            </div>
          </Section>
        </div>
      ) : null}

      {tab === "share" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Section title="分享卡片" description="Open Graph / Twitter 卡片使用这里的图片。">
            <div className="flex items-start gap-3">
              <Thumb src={draft.share.image} className="size-20 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="share-image">分享图片</Label>
                <Input
                  id="share-image"
                  value={draft.share.image}
                  maxLength={SITE_SETTINGS_LIMITS.image}
                  onChange={(event) => updateShare({ image: event.target.value })}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-500">
                  建议 1200×630；环境变量 SITE_SHARE_IMAGE 存在时优先生效。
                </p>
              </div>
            </div>
            <Field id="share-card" label="卡片类型" hint="大图卡片在社交平台展示更醒目。">
              <Select
                id="share-card"
                value={draft.share.card}
                onChange={(event) =>
                  updateShare({ card: event.target.value as SiteShareCard })
                }
              >
                <option value="summary_large_image">summary_large_image（大图）</option>
                <option value="summary">summary（小图）</option>
              </Select>
            </Field>
          </Section>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>预览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div
                className="aspect-[1.91/1] w-full rounded-xl border border-slate-200/80 bg-slate-900/[0.04] bg-cover bg-center dark:border-white/10 dark:bg-white/5"
                style={
                  isSafeAssetUrl(draft.share.image)
                    ? { backgroundImage: "url(" + draft.share.image.trim() + ")" }
                    : undefined
                }
              />
              <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
                {draft.profile.siteTitle || "站点标题"}
              </p>
              <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {draft.profile.bio || "站点简介"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "content" ? (
        <div className="space-y-5">
          <Section title="留言板" description="说说 / 留言页的标题与描述。">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="chatter-title"
                label="标题"
                hint={"最多 " + SITE_SETTINGS_LIMITS.chatterTitle + " 个字符"}
              >
                <Input
                  id="chatter-title"
                  value={draft.content.chatterTitle}
                  maxLength={SITE_SETTINGS_LIMITS.chatterTitle}
                  onChange={(event) => updateContent({ chatterTitle: event.target.value })}
                />
              </Field>
              <Field
                id="chatter-description"
                label="描述"
                hint={"最多 " + SITE_SETTINGS_LIMITS.chatterDescription + " 个字符"}
              >
                <Input
                  id="chatter-description"
                  value={draft.content.chatterDescription}
                  maxLength={SITE_SETTINGS_LIMITS.chatterDescription}
                  onChange={(event) =>
                    updateContent({ chatterDescription: event.target.value })
                  }
                />
              </Field>
            </div>
          </Section>

          <Section
            title="页脚徽标"
            description="页脚展示的技术栈标签，颜色填 Tailwind 文本色类名。"
            action={
              <Button
                variant="outline"
                size="sm"
                disabled={draft.content.footerBadges.length >= SITE_SETTINGS_LIMITS.footerBadges}
                onClick={() =>
                  updateContent({
                    footerBadges: [
                      ...draft.content.footerBadges,
                      { name: "", color: "text-sky-500" },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" aria-hidden />
                添加徽标
              </Button>
            }
          >
            {draft.content.footerBadges.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-500">
                暂无徽标，页脚不展示技术栈标签。
              </p>
            ) : (
              <div className="space-y-2">
                {draft.content.footerBadges.map((badge, index) => (
                  <div key={"badge-" + index} className="flex items-center gap-2">
                    <Input
                      value={badge.name}
                      aria-label={"第 " + (index + 1) + " 个徽标名称"}
                      placeholder="Next.js 15"
                      maxLength={SITE_SETTINGS_LIMITS.badgeName}
                      onChange={(event) => {
                        const next = draft.content.footerBadges.map((item, i) =>
                          i === index ? { ...item, name: event.target.value } : item,
                        );
                        updateContent({ footerBadges: next });
                      }}
                    />
                    <Input
                      value={badge.color}
                      aria-label={"第 " + (index + 1) + " 个徽标颜色"}
                      placeholder="text-sky-500"
                      maxLength={SITE_SETTINGS_LIMITS.badgeColor}
                      className="font-mono text-xs"
                      onChange={(event) => {
                        const next = draft.content.footerBadges.map((item, i) =>
                          i === index ? { ...item, color: event.target.value } : item,
                        );
                        updateContent({ footerBadges: next });
                      }}
                    />
                    <span
                      className={cn(
                        "hidden shrink-0 rounded-full border border-slate-200/80 px-2 py-0.5 text-[11px] sm:inline dark:border-white/10",
                        badge.color,
                      )}
                    >
                      {badge.name || "徽标"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="删除徽标"
                      onClick={() => {
                        const next = draft.content.footerBadges.filter(
                          (_, i) => i !== index,
                        );
                        updateContent({ footerBadges: next });
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="备案信息" description="页脚底部展示，留空则不显示。">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="icp-name" label="ICP 备案号">
                <Input
                  id="icp-name"
                  value={draft.content.icp.name}
                  maxLength={SITE_SETTINGS_LIMITS.icpName}
                  placeholder="京 ICP 备 12345678 号"
                  onChange={(event) =>
                    updateContent({
                      icp: { ...draft.content.icp, name: event.target.value },
                    })
                  }
                />
              </Field>
              <Field id="icp-link" label="ICP 备案链接">
                <Input
                  id="icp-link"
                  value={draft.content.icp.link}
                  placeholder="https://beian.miit.gov.cn"
                  onChange={(event) =>
                    updateContent({
                      icp: { ...draft.content.icp, link: event.target.value },
                    })
                  }
                />
              </Field>
              <Field id="moe-icp-name" label="萌备案号">
                <Input
                  id="moe-icp-name"
                  value={draft.content.moeIcp.name}
                  maxLength={SITE_SETTINGS_LIMITS.icpName}
                  onChange={(event) =>
                    updateContent({
                      moeIcp: { ...draft.content.moeIcp, name: event.target.value },
                    })
                  }
                />
              </Field>
              <Field id="moe-icp-link" label="萌备案链接">
                <Input
                  id="moe-icp-link"
                  value={draft.content.moeIcp.link}
                  placeholder="https://icp.gov.moe"
                  onChange={(event) =>
                    updateContent({
                      moeIcp: { ...draft.content.moeIcp, link: event.target.value },
                    })
                  }
                />
              </Field>
            </div>
          </Section>
        </div>
      ) : null}

      {tab === "music" ? (
        <div className="space-y-5">
          <Section
            title="网易云音乐"
            description="填歌单 ID 会自动拉取整个歌单；歌单为空时使用下方歌曲列表。"
          >
            <Field
              id="playlist-id"
              label="歌单 ID"
              hint="例如 17943739323；留空则只播放歌曲列表。"
            >
              <Input
                id="playlist-id"
                value={draft.music.playlistId}
                maxLength={SITE_SETTINGS_LIMITS.musicId}
                placeholder="17943739323"
                onChange={(event) => updateMusic({ playlistId: event.target.value })}
              />
            </Field>
            <Field
              id="track-ids"
              label="歌曲 ID 列表"
              hint={
                "每行一个数字 ID，或用逗号分隔；最多 " +
                SITE_SETTINGS_LIMITS.musicTrackIds +
                " 首。"
              }
            >
              <Textarea
                id="track-ids"
                value={draft.music.trackIds.join("\n")}
                className="min-h-32 font-mono text-xs leading-6"
                placeholder={"1824045033\n1974443814"}
                onChange={(event) =>
                  updateMusic({
                    trackIds: event.target.value
                      .split(/[\s,\uff0c]+/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-500">
              <Wand2 className="size-3.5" aria-hidden />
              当前共 {draft.music.trackIds.length} 首指定歌曲。
            </p>
          </Section>
        </div>
      ) : null}

      {error ? <AdminError message={error} /> : null}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/30">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {dirty ? "有未保存的修改" : "所有修改已保存"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setDraft(toDraft(settings));
              setError(null);
            }}
            disabled={saving || !dirty}
          >
            还原
          </Button>
          <Button onClick={save} disabled={saving || !dirty}>
            <Save className="size-4" aria-hidden />
            {saving ? "保存中…" : "保存设置"}
          </Button>
        </div>
      </div>
    </div>
  );
}
