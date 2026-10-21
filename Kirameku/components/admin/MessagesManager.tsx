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
import type { MessageItem } from "@/server/modules/messages/contracts";

const pageSize = 20;

interface MessageNodeProps {
  message: MessageItem;
  depth: number;
  busyId: number | null;
  onStatus: (message: MessageItem, status: string) => void;
  onDelete: (message: MessageItem) => void;
}

function MessageNode({
  message,
  depth,
  busyId,
  onStatus,
  onDelete,
}: MessageNodeProps) {
  const user = message.github_user;
  const busy = busyId === message.id;

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
          <StatusBadge status={message.status} />
          <span className="text-[11px] text-slate-600">
            {formatDateTime(message.created_at)}
          </span>
          {message.ip ? (
            <span className="font-mono text-[10px] text-slate-700">
              {message.ip}
            </span>
          ) : null}
        </div>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {message.content}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {message.status !== "approved" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onStatus(message, "approved")}
            >
              <Check className="size-3.5 text-emerald-300" aria-hidden />
              通过
            </Button>
          ) : null}
          {message.status !== "rejected" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onStatus(message, "rejected")}
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
            onClick={() => onDelete(message)}
          >
            <Trash2 className="size-3.5" aria-hidden />
            删除
          </Button>
          {busy ? (
            <span className="text-[11px] text-slate-600">处理中…</span>
          ) : null}
        </div>
      </article>

      {message.replies.length > 0 ? (
        <div>
          {message.replies.map((reply) => (
            <MessageNode
              key={reply.id}
              message={reply}
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

export default function MessagesManager() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const path = `/api/admin/messages${adminQuery({
    status,
    page,
    size: pageSize,
  })}`;
  const {
    data: messages,
    loading,
    error,
    reload,
  } = useAdminData<MessageItem[]>(path);
  const { data: countData } = useAdminData<{ count: number }>(
    `/api/admin/messages/count${adminQuery({ status })}`,
  );

  async function updateStatus(message: MessageItem, nextStatus: string) {
    setBusyId(message.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/messages/${message.id}/status`, {
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

  async function removeMessage(message: MessageItem) {
    if (!window.confirm("确定删除这条留言？所有回复会一并删除。")) return;
    setBusyId(message.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/messages/${message.id}`, {
        method: "DELETE",
      });
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
        title="留言"
        description="审核留言板内容；删除父留言会级联删除所有回复。"
        actions={
          <div className="flex items-center gap-2">
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
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </Select>
            <Button variant="outline" onClick={reload}>
              <RefreshCw className="size-4" aria-hidden />
              刷新
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>全部留言</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              列表包含所有状态和递归回复；筛选只作用于顶层留言。
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

        {loading && !messages ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            正在加载留言…
          </div>
        ) : messages && messages.length > 0 ? (
          <>
            <div className="px-5">
              {messages.map((message) => (
                <MessageNode
                  key={message.id}
                  message={message}
                  depth={0}
                  busyId={busyId}
                  onStatus={updateStatus}
                  onDelete={removeMessage}
                />
              ))}
            </div>
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={countData?.count}
              hasNext={messages.length === pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <AdminEmptyState
            title="没有匹配的留言"
            description="当前筛选条件下没有留言。"
          />
        )}
      </Card>
    </div>
  );
}
