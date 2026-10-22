"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import AdminPagination from "./AdminPagination";
import StatusBadge from "./StatusBadge";
import { useConfirm } from "./ConfirmProvider";
import { adminQuery, adminRequest, describeAdminError } from "./admin-api";
import { formatDateTime } from "./format";
import { useAdminData } from "./use-admin-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CategoryItem,
  PostItem,
  TagItem,
} from "@/server/modules/posts/contracts";

const pageSize = 20;

export default function PostsManager() {
  const confirm = useConfirm();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const listPath = `/api/admin/posts${adminQuery({
    status,
    category,
    tag,
    page,
    size: pageSize,
  })}`;
  const {
    data: posts,
    loading,
    error,
    reload,
  } = useAdminData<PostItem[]>(listPath);
  const { data: countData } = useAdminData<{ count: number }>(
    `/api/admin/posts/count${adminQuery({ status })}`,
  );
  const { data: categories } = useAdminData<CategoryItem[]>(
    "/api/admin/categories",
  );
  const { data: tags } = useAdminData<TagItem[]>("/api/admin/tags");

  const filtered = Boolean(category || tag);
  const total = filtered ? undefined : countData?.count;
  const hasNext = posts?.length === pageSize;

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  async function togglePublished(post: PostItem) {
    const nextStatus = post.status === "published" ? "draft" : "published";
    setMutatingId(post.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/posts/${post.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });
      reload();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setMutatingId(null);
    }
  }

  async function removePost(post: PostItem) {
    if (!await confirm(`确定删除文章「${post.title}」？此操作不可撤销。`)) {
      return;
    }
    setMutatingId(post.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/posts/${post.id}`, { method: "DELETE" });
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
        title="文章"
        description="管理文章状态、分类、标签和正文。发布后前台立即可读。"
        actions={
          <Link href="/admin/posts/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden />
            新建文章
          </Link>
        }
      />

      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle>全部文章</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              包含草稿和已发布内容。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="按状态筛选"
              value={status}
              onChange={(event) => updateFilter(setStatus, event.target.value)}
              className="w-32"
            >
              <option value="">全部状态</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
            </Select>
            <Select
              aria-label="按分类筛选"
              value={category}
              onChange={(event) => updateFilter(setCategory, event.target.value)}
              className="w-36"
            >
              <option value="">全部分类</option>
              {(categories ?? []).map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="按标签筛选"
              value={tag}
              onChange={(event) => updateFilter(setTag, event.target.value)}
              className="w-36"
            >
              <option value="">全部标签</option>
              {(tags ?? []).map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={reload}
              aria-label="刷新"
              title="刷新"
            >
              <RefreshCw className="size-4" aria-hidden />
            </Button>
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

        {loading && !posts ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            正在加载文章…
          </div>
        ) : posts && posts.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>标题</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead>数据</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="max-w-72">
                        <Link
                          href={`/admin/posts/${post.id}`}
                          className="block truncate font-medium text-slate-200 hover:text-sky-300"
                        >
                          {post.title}
                        </Link>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600">
                          /posts/{post.slug}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={post.status} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {post.category || "—"}
                      </TableCell>
                      <TableCell className="max-w-44">
                        <div className="flex flex-wrap gap-1">
                          {post.tags.length > 0 ? (
                            post.tags.map((item) => (
                              <span
                                key={item}
                                className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500"
                              >
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
                        {post.views} 阅读 · {post.likes} 赞
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-slate-500">
                        {formatDateTime(post.updated_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={mutatingId === post.id}
                            onClick={() => togglePublished(post)}
                          >
                            {post.status === "published" ? "转草稿" : "发布"}
                          </Button>
                          <Link
                            href={`/admin/posts/${post.id}`}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "icon",
                            })}
                            aria-label={`编辑 ${post.title}`}
                            title="编辑"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-500 hover:text-rose-300"
                            disabled={mutatingId === post.id}
                            onClick={() => removePost(post)}
                            aria-label={`删除 ${post.title}`}
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
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={total}
              hasNext={hasNext}
              onPageChange={setPage}
            />
          </>
        ) : (
          <AdminEmptyState
            title="还没有文章"
            description="创建第一篇文章，支持 Markdown 正文、分类、标签和草稿状态。"
            action={
              <Link
                href="/admin/posts/new"
                className={buttonVariants({ size: "sm" })}
              >
                <Plus className="size-3.5" aria-hidden />
                新建文章
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}
