"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import AdminPagination from "./AdminPagination";
import { adminQuery } from "./admin-api";
import { formatDateTime } from "./format";
import { useAdminData } from "./use-admin-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLogList } from "@/server/modules/audit/contracts";

const pageSize = 30;

const actionMeta: Record<
  string,
  {
    label: string;
    variant: "success" | "info" | "danger" | "warning" | "muted";
  }
> = {
  create: { label: "创建", variant: "success" },
  update: { label: "更新", variant: "info" },
  delete: { label: "删除", variant: "danger" },
  status: { label: "状态变更", variant: "warning" },
  upload: { label: "上传", variant: "info" },
  clear: { label: "清空", variant: "danger" },
};

const targetLabels: Record<string, string> = {
  posts: "文章",
  projects: "项目",
  chatters: "说说",
  comments: "评论",
  messages: "留言",
  categories: "分类",
  tags: "标签",
  "friend-links": "友链",
  bookmarks: "收藏夹",
  albums: "相册",
  "site-config": "站点配置",
  visitors: "访客",
  upload: "图片",
  admin: "后台",
};

function detailString(
  detail: Record<string, unknown>,
  key: string,
): string | null {
  const value = detail[key];
  return typeof value === "string" ? value : null;
}

export default function AuditLogManager() {
  const [page, setPage] = useState(1);
  const path = `/api/admin/audit${adminQuery({ page, size: pageSize })}`;
  const {
    data: audit,
    loading,
    error,
    reload,
  } = useAdminData<AuditLogList>(path);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Security"
        title="操作审计"
        description="自动记录后台新增、修改、删除、状态变更和上传操作；日志只读，用于追溯变更。"
        actions={
          <Button variant="outline" onClick={reload}>
            <RefreshCw className="size-4" aria-hidden />
            刷新
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>审计日志</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              共 {audit?.total ?? 0} 条
            </p>
          </div>
        </CardHeader>

        {error ? (
          <div className="px-5 pt-4">
            <AdminError message={error} />
          </div>
        ) : null}

        {loading && !audit ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            正在加载审计日志…
          </div>
        ) : audit && audit.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>动作</TableHead>
                    <TableHead>资源</TableHead>
                    <TableHead>请求路径</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.items.map((item) => {
                    const meta = actionMeta[item.action] ?? {
                      label: item.action,
                      variant: "muted" as const,
                    };
                    const targetLabel =
                      targetLabels[item.target_type] || item.target_type || "—";
                    const method = detailString(item.detail, "method");
                    const requestPath = detailString(item.detail, "path");

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs whitespace-nowrap text-slate-500">
                          {formatDateTime(item.created_at)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-300">
                          {item.actor_name}
                          {item.actor_id ? (
                            <span className="ml-1 text-[10px] text-slate-600">
                              #{item.actor_id}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {targetLabel}
                          {item.target_id ? (
                            <span className="ml-1 font-mono text-[10px] text-slate-600">
                              #{item.target_id}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-72">
                          <p className="font-mono text-[11px] text-slate-400">
                            {requestPath ?? "—"}
                          </p>
                          {method ? (
                            <p className="mt-0.5 text-[10px] text-slate-600">
                              {method}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-500">
                          {item.ip || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={audit.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <AdminEmptyState
            title="还没有审计记录"
            description="后台执行新增、修改、删除或上传后，这里会自动出现对应日志。"
          />
        )}
      </Card>
    </div>
  );
}
