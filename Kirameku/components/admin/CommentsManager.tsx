"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, RefreshCw, Trash2, X } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import AdminPagination from "./AdminPagination";
import StatusBadge from "./StatusBadge";
import { adminQuery, adminRequest, describeAdminError } from "./admin-api";
import { formatDateTime } from "./format";
import { useAdminData } from "./use-admin-data";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type {
  AdminChatterCommentItem,
  AdminPostCommentItem,
} from "@/server/modules/comments/contracts";

const pageSize = 20;

type Tab = "post" | "chatter";
type AdminComment = AdminPostCommentItem | AdminChatterCommentItem;

interface CommentNodeProps {
  comment: AdminComment;
  depth: number;
  busyId: number | null;
  onStatus: (comment: AdminComment, status: string) => void;
  onDelete: (comment: AdminComment) => void;
}

function CommentNode({
  comment,
  depth,
  busyId,
  onStatus,
  onDelete,
}: CommentNodeProps) {
  const user = comment.github_user;
  const busy = busyId === comment.id;

  return (
    <div
      className={
        depth > 0
          ? "ml-4 border-l border-white/10 pl-4 sm:ml-6 sm:pl-5"
          : ""
      }
    >
      <article className="py-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {user?.avatar ? (
            <Image
              src={user.avatar}
              alt=""
              width={24}
              height={24}
              className="size-6 rounded-full border border-white/10"
              unoptimized
            />
          ) : (
            <span className="grid size-6 place-items-center rounded-full bg-white/5 text-[10px] text-slate-500">
              {(user?.login ?? "匿").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-xs font-medium text-slate-300">
            {user?.login ?? "匿名用户"}
          </span>
          <StatusBadge status={comment.status} />
          <span className="text-[11px] text-slate-600">
            {formatDateTime(comment.created_at)}
          </span>
          {comment.ip ? (
            <span className="font-mono text-[10px] text-slate-700">
              {comment.ip}
            </span>
          ) : null}
          <span className="ml-auto text-[10px] text-slate-600">
            {"post_id" in comment
              ? `文章 #${comment.post_id}`
              : `说说 #${comment.chatter_id}`}
          </span>
        </div>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {comment.content}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {comment.status !== "approved" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onStatus(comment, "approved")}
            >
              <Check className="size-3.5 text-emerald-300" aria-hidden />
              通过
            </Button>
          ) : null}
          {comment.status !== "rejected" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onStatus(comment, "rejected")}
            >
              <X className="size-3.5 text-rose-300" aria-hidden />
              驳回
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-rose-300"
            disabled={busy}
            onClick={() => onDelete(comment)}
          >
            <Trash2 className="size-3.5" aria-hidden />
            删除
          </Button>
          {busy ? (
            <span className="text-[11px] text-slate-600">处理中…</span>
          ) : null}
        </div>
      </article>

      {comment.replies.length > 0 ? (
        <div>
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              busyId={busyId}
              onStatus={onStatus}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CommentsManager() {
  const [tab, setTab] = useState<Tab>("post");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const basePath =
    tab === "post" ? "/api/admin/comments" : "/api/admin/chatters/comments";
  const path = `${basePath}${adminQuery({ status, page, size: pageSize })}`;
  const {
    data: comments,
    loading,
    error,
    reload,
  } = useAdminData<AdminComment[]>(path);

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setPage(1);
    setActionError(null);
  }

  async function updateStatus(comment: AdminComment, nextStatus: string) {
    const pathPrefix =
      tab === "post"
        ? `/api/admin/comments/${comment.id}/status`
        : `/api/admin/chatters/comments/${comment.id}/status`;
    setBusyId(comment.id);
    setActionError(null);
    try {
      await adminRequest(pathPrefix, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });
      reload();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setBusyId(null);
    }
  }

  async function removeComment(comment: AdminComment) {
    if (!window.confirm("确定删除这条评论？所有回复会一并删除。")) return;
    const pathPrefix =
      tab === "post"
        ? `/api/admin/comments/${comment.id}`
        : `/api/admin/chatters/comments/${comment.id}`;
    setBusyId(comment.id);
    setActionError(null);
    try {
      await adminRequest(pathPrefix, { method: "DELETE" });
      reload();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminPageHeader
        eyebrow="Moderation"
        title="评论"
        description="审核文章评论和说说评论；删除父评论会级联删除所有回复。"
        actions={
          <Button variant="outline" onClick={reload}>
            <RefreshCw className="size-4" aria-hidden />
            刷新
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={tab === "post" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => changeTab("post")}
        >
          文章评论
        </Button>
        <Button
          variant={tab === "chatter" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => changeTab("chatter")}
        >
          说说评论
        </Button>
        <Select
          aria-label="按状态筛选"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="ml-auto w-32"
        >
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{tab === "post" ? "文章评论" : "说说评论"}</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              列表包含所有状态和递归回复；筛选只作用于顶层评论。
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

        {loading && !comments ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            正在加载评论…
          </div>
        ) : comments && comments.length > 0 ? (
          <>
            <div className="px-5">
              {comments.map((comment) => (
                <CommentNode
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  busyId={busyId}
                  onStatus={updateStatus}
                  onDelete={removeComment}
                />
              ))}
            </div>
            <AdminPagination
              page={page}
              pageSize={pageSize}
              hasNext={comments.length === pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <AdminEmptyState
            title="没有匹配的评论"
            description="当前筛选条件下没有评论。"
          />
        )}
      </Card>
    </div>
  );
}
