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
import type { ProjectItem } from "@/server/modules/projects/contracts";

interface ProjectEditorProps {
  projectId?: number;
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  longDescription: string;
  coverImage: string;
  techStack: string;
  linkGithub: string;
  linkGitee: string;
  linkLive: string;
  linkDocs: string;
  status: string;
  statusLabel: string;
  isFeatured: boolean;
  sort: string;
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  longDescription: "",
  coverImage: "",
  techStack: "",
  linkGithub: "",
  linkGitee: "",
  linkLive: "",
  linkDocs: "",
  status: "developing",
  statusLabel: "",
  isFeatured: false,
  sort: "0",
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

export default function ProjectEditor({ projectId }: ProjectEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(Boolean(projectId));
  const [loading, setLoading] = useState(Boolean(projectId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    adminRequest<ProjectItem>(`/api/admin/projects/${projectId}`)
      .then((project) => {
        if (!active) return;
        setForm({
          name: project.name,
          slug: project.slug,
          description: project.description,
          longDescription: project.long_description,
          coverImage: project.cover_image,
          techStack: project.tech_stack.join(", "),
          linkGithub: project.link_github,
          linkGitee: project.link_gitee,
          linkLive: project.link_live,
          linkDocs: project.link_docs,
          status: project.status,
          statusLabel: project.status_label,
          isFeatured: project.is_featured,
          sort: String(project.sort),
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
  }, [projectId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateName(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: slugTouched ? current.slug : slugify(value),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      setError("项目名称和 slug 不能为空");
      return;
    }

    const body = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description,
      long_description: form.longDescription,
      cover_image: form.coverImage.trim(),
      tech_stack: Array.from(
        new Set(
          form.techStack
            .split(/[,，\n]/)
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ),
      link_github: form.linkGithub.trim(),
      link_gitee: form.linkGitee.trim(),
      link_live: form.linkLive.trim(),
      link_docs: form.linkDocs.trim(),
      status: form.status,
      status_label: form.statusLabel.trim(),
      is_featured: form.isFeatured,
      sort: Number(form.sort) || 0,
    };

    setSaving(true);
    setError(null);
    try {
      await adminRequest(
        projectId
          ? `/api/admin/projects/${projectId}`
          : "/api/admin/projects",
        {
          method: projectId ? "PUT" : "POST",
          body: JSON.stringify(body),
        },
      );
      router.push("/admin/projects");
      router.refresh();
    } catch (reason) {
      setError(describeAdminError(reason));
      setSaving(false);
    }
  }

  async function remove() {
    if (!projectId) return;
    if (!window.confirm("确定删除这个项目？此操作不可撤销。")) return;
    setDeleting(true);
    setError(null);
    try {
      await adminRequest(`/api/admin/projects/${projectId}`, {
        method: "DELETE",
      });
      router.push("/admin/projects");
      router.refresh();
    } catch (reason) {
      setError(describeAdminError(reason));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl py-16 text-center text-sm text-slate-500">
        正在加载项目…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/projects"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            返回项目列表
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {projectId ? "编辑项目" : "新建项目"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {projectId ? `项目 ID #${projectId}` : "项目会直接展示在前台 /projects。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {projectId ? (
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
            href="/admin/projects"
            className={buttonVariants({ variant: "outline" })}
          >
            取消
          </Link>
          <Button type="submit" disabled={saving || deleting}>
            <Save className="size-4" aria-hidden />
            {saving ? "保存中…" : "保存项目"}
          </Button>
        </div>
      </header>

      {error ? <AdminError message={error} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="project-name">项目名称</Label>
                  <Input
                    id="project-name"
                    value={form.name}
                    onChange={(event) => updateName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="project-slug">Slug</Label>
                  <Input
                    id="project-slug"
                    value={form.slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      update("slug", event.target.value);
                    }}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-description">简介</Label>
                <Textarea
                  id="project-description"
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  className="min-h-20"
                  placeholder="展示在项目卡片上的短描述"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-long-description">详细介绍</Label>
                <Textarea
                  id="project-long-description"
                  value={form.longDescription}
                  onChange={(event) =>
                    update("longDescription", event.target.value)
                  }
                  className="min-h-40"
                  placeholder="项目详情、架构、功能说明…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-cover">封面图片</Label>
                <Input
                  id="project-cover"
                  value={form.coverImage}
                  onChange={(event) => update("coverImage", event.target.value)}
                  placeholder="/images/projects/example.webp"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-tech">技术栈</Label>
                <Input
                  id="project-tech"
                  value={form.techStack}
                  onChange={(event) => update("techStack", event.target.value)}
                  placeholder="Next.js, TypeScript, SQLite"
                />
                <p className="text-[11px] text-slate-600">用逗号分隔。</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-sm font-semibold text-white">相关链接</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="project-github">GitHub</Label>
                <Input
                  id="project-github"
                  value={form.linkGithub}
                  onChange={(event) => update("linkGithub", event.target.value)}
                  placeholder="https://github.com/..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-gitee">Gitee</Label>
                <Input
                  id="project-gitee"
                  value={form.linkGitee}
                  onChange={(event) => update("linkGitee", event.target.value)}
                  placeholder="https://gitee.com/..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-live">在线地址</Label>
                <Input
                  id="project-live"
                  value={form.linkLive}
                  onChange={(event) => update("linkLive", event.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-docs">文档</Label>
                <Input
                  id="project-docs"
                  value={form.linkDocs}
                  onChange={(event) => update("linkDocs", event.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-sm font-semibold text-white">展示设置</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="project-status">状态</Label>
                <Select
                  id="project-status"
                  value={form.status}
                  onChange={(event) => update("status", event.target.value)}
                >
                  <option value="developing">开发中</option>
                  <option value="active">维护中</option>
                  <option value="archived">已归档</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-status-label">状态文案</Label>
                <Input
                  id="project-status-label"
                  value={form.statusLabel}
                  onChange={(event) => update("statusLabel", event.target.value)}
                  placeholder="留空使用默认文案"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-sort">排序</Label>
                <Input
                  id="project-sort"
                  type="number"
                  value={form.sort}
                  onChange={(event) => update("sort", event.target.value)}
                />
                <p className="text-[11px] text-slate-600">数字越小越靠前。</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) =>
                    update("isFeatured", event.target.checked)
                  }
                  className="size-3.5 rounded border-white/20 bg-slate-950 accent-sky-400"
                />
                推荐项目
              </label>
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
