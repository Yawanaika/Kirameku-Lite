"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquare, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import type { ChatterItem } from "@/server/modules/chatters/contracts";

const pageSize = 20;

export default function ChattersManager() {
  const confirm = useConfirm();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const listPath = `/api/admin/chatters${adminQuery({
    status,
    page,
    size: pageSize,
  })}`;
  const {
    data: chatters,
    loading,
    error,
    reload,
  } = useAdminData<ChatterItem[]>(listPath);
  const { data: countData } = useAdminData<{ count: number }>(
    `/api/admin/chatters/count${adminQuery({ status })}`,
  );

  async function togglePublished(chatter: ChatterItem) {
    const nextStatus =
      chatter.status === "published" ? "draft" : "published";
    setMutatingId(chatter.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/chatters/${chatter.id}`, {
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

  async function removeChatter(chatter: ChatterItem) {
    if (
      !await confirm(
        "确定删除这条说说？关联的说说评论会一并删除，此操作不可撤销。",
      )
    ) {
      return;
    }
    setMutatingId(chatter.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/chatters/${chatter.id}`, {
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
        title="说说"
        description="管理说说正文、图片、心情和发布状态；删除会级联删除评论。"
        actions={
          <Link href="/admin/chatters/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden />
            新建说说
          </Link>
        }
      />

      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle>全部说说</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              包含草稿和已发布内容。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="按状态筛选"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-32"
            >
              <option value="">全部状态</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
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

        {loading && !chatters ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            正在加载说说…
          </div>
        ) : chatters && chatters.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>心情</TableHead>
                    <TableHead>互动</TableHead>
                    <TableHead>发布时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chatters.map((chatter) => (
                    <TableRow key={chatter.id}>
                      <TableCell className="max-w-96">
                        <Link
                          href={`/admin/chatters/${chatter.id}`}
                          className="line-clamp-2 text-sm text-slate-200 hover:text-sky-300"
                        >
                          {chatter.content}
                        </Link>
                        <p className="mt-1 text-[11px] text-slate-600">
                          {chatter.images.length > 0
                            ? `${chatter.images.length} 张图片`
                            : "无图片"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={chatter.status} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {chatter.mood || "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
                        {chatter.likes} 赞 · {chatter.comments_count} 评论
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-slate-500">
                        {formatDateTime(chatter.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={mutatingId === chatter.id}
                            onClick={() => togglePublished(chatter)}
                          >
                            {chatter.status === "published" ? "转草稿" : "发布"}
                          </Button>
                          <Link
                            href={`/admin/chatters/${chatter.id}`}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "icon",
                            })}
                            aria-label="编辑说说"
                            title="编辑"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-500 hover:text-rose-300"
                            disabled={mutatingId === chatter.id}
                            onClick={() => removeChatter(chatter)}
                            aria-label="删除说说"
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
              total={countData?.count}
              hasNext={chatters.length === pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <AdminEmptyState
            title="还没有说说"
            description="发布一条说说，记录此刻的心情和图片。"
            action={
              <Link
                href="/admin/chatters/new"
                className={buttonVariants({ size: "sm" })}
              >
                <MessageSquare className="size-3.5" aria-hidden />
                新建说说
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}
