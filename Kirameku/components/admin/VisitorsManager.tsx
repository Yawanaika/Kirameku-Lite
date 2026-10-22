"use client";

import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import AdminPagination from "./AdminPagination";
import { useConfirm } from "./ConfirmProvider";
import { adminQuery, adminRequest, describeAdminError } from "./admin-api";
import { formatDateTime } from "./format";
import { useAdminData } from "./use-admin-data";
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
import type { VisitorItem } from "@/server/modules/visitors/contracts";

const pageSize = 20;

export default function VisitorsManager() {
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const path = `/api/admin/visitors${adminQuery({ page, size: pageSize })}`;
  const {
    data: visitors,
    loading,
    error,
    reload,
  } = useAdminData<VisitorItem[]>(path);
  const { data: countData, reload: reloadCount } = useAdminData<{
    count: number;
  }>("/api/admin/visitors/count");

  async function remove(item: VisitorItem) {
    if (!await confirm(`确定删除访客记录 ${item.ip}？`)) return;
    setBusyId(item.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/visitors/${item.id}`, {
        method: "DELETE",
      });
      if (visitors?.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        reload();
      }
      reloadCount();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setBusyId(null);
    }
  }

  async function clearAll() {
    if (!await confirm("确定清空全部访客记录？此操作不可撤销。")) return;
    setClearing(true);
    setActionError(null);
    try {
      await adminRequest("/api/admin/visitors", { method: "DELETE" });
      setPage(1);
      reload();
      reloadCount();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Analytics"
        title="访客"
        description="查看站点访问记录和 IP 归属信息；删除操作只影响本地记录。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={reload}>
              <RefreshCw className="size-4" aria-hidden />
              刷新
            </Button>
            <Button
              variant="destructive"
              onClick={clearAll}
              disabled={clearing}
            >
              <Trash2 className="size-4" aria-hidden />
              {clearing ? "清空中…" : "清空记录"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>访问记录</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              共 {countData?.count ?? 0} 条
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

        {loading && !visitors ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            正在加载访客记录…
          </div>
        ) : visitors && visitors.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>IP / 路径</TableHead>
                    <TableHead>归属地</TableHead>
                    <TableHead>运营商</TableHead>
                    <TableHead>设备</TableHead>
                    <TableHead>标记</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitors.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-64">
                        <p className="font-mono text-xs text-slate-300">
                          {item.ip}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600">
                          {item.path || "/"}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {[item.country, item.region, item.city, item.district]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="max-w-48 text-xs text-slate-500">
                        {item.org_cn || item.org || "—"}
                        {item.asn ? (
                          <span className="ml-1 text-[10px] text-slate-600">
                            {item.asn}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {[item.browser, item.os, item.device_type]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.is_mobile ? (
                            <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[10px] text-sky-300">
                              移动
                            </span>
                          ) : null}
                          {item.is_proxy ? (
                            <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                              代理
                            </span>
                          ) : null}
                          {item.is_hosting ? (
                            <span className="rounded bg-rose-400/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                              机房
                            </span>
                          ) : null}
                          {!item.is_mobile && !item.is_proxy && !item.is_hosting ? (
                            <span className="text-xs text-slate-600">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-slate-500">
                        {formatDateTime(item.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-500 hover:text-rose-300"
                            disabled={busyId === item.id}
                            onClick={() => remove(item)}
                            aria-label={`删除访客 ${item.ip}`}
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
              hasNext={visitors.length === pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <AdminEmptyState
            title="还没有访客记录"
            description="站点产生访问后，这里会显示 IP、归属地和设备信息。"
          />
        )}
      </Card>
    </div>
  );
}
