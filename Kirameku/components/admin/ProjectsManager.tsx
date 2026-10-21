"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import StatusBadge from "./StatusBadge";
import { adminRequest, describeAdminError } from "./admin-api";
import { formatDateTime } from "./format";
import { useAdminData } from "./use-admin-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectItem } from "@/server/modules/projects/contracts";

export default function ProjectsManager() {
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    data: projects,
    loading,
    error,
    reload,
  } = useAdminData<ProjectItem[]>("/api/admin/projects");

  async function toggleFeatured(project: ProjectItem) {
    setMutatingId(project.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/projects/${project.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_featured: !project.is_featured }),
      });
      reload();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setMutatingId(null);
    }
  }

  async function removeProject(project: ProjectItem) {
    if (!window.confirm(`确定删除项目「${project.name}」？`)) return;
    setMutatingId(project.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/projects/${project.id}`, {
        method: "DELETE",
      });
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
        eyebrow="Content"
        title="项目"
        description="项目数据直接驱动前台 /projects 页面，修改后无需重新部署。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={reload} aria-label="刷新">
              <RefreshCw className="size-4" aria-hidden />
            </Button>
            <Link href="/admin/projects/new" className={buttonVariants()}>
              <Plus className="size-4" aria-hidden />
              新建项目
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>全部项目</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              按排序值升序展示，排序值相同的按创建顺序。
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

        {loading && !projects ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            正在加载项目…
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>技术栈</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>推荐</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="max-w-80">
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="block truncate font-medium text-slate-200 hover:text-sky-300"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-0.5 truncate text-[11px] text-slate-600">
                        {project.description || project.slug}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={project.status}
                        label={project.status_label || undefined}
                      />
                    </TableCell>
                    <TableCell className="max-w-56">
                      <div className="flex flex-wrap gap-1">
                        {project.tech_stack.slice(0, 4).map((item) => (
                          <span
                            key={item}
                            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500"
                          >
                            {item}
                          </span>
                        ))}
                        {project.tech_stack.length > 4 ? (
                          <span className="text-[10px] text-slate-600">
                            +{project.tech_stack.length - 4}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 tabular-nums">
                      {project.sort}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={mutatingId === project.id}
                        onClick={() => toggleFeatured(project)}
                        className={
                          project.is_featured ? "text-amber-300" : "text-slate-600"
                        }
                      >
                        <Star
                          className="size-3.5"
                          fill={project.is_featured ? "currentColor" : "none"}
                          aria-hidden
                        />
                        {project.is_featured ? "已推荐" : "未推荐"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-slate-500">
                      {formatDateTime(project.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/projects/${project.id}`}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                          })}
                          aria-label={`编辑 ${project.name}`}
                          title="编辑"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-500 hover:text-rose-300"
                          disabled={mutatingId === project.id}
                          onClick={() => removeProject(project)}
                          aria-label={`删除 ${project.name}`}
                          title="删除"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <AdminEmptyState
            title="还没有项目"
            description="创建项目后，前台 /projects 页面会直接展示。"
            action={
              <Link
                href="/admin/projects/new"
                className={buttonVariants({ size: "sm" })}
              >
                <Plus className="size-3.5" aria-hidden />
                新建项目
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}
