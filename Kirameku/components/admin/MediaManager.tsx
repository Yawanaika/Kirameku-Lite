/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowUpRight, RefreshCw } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import AdminPagination from "./AdminPagination";
import { useAdminData } from "./use-admin-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { MediaItem, MediaOverview, MediaSort } from "@/server/modules/media/contracts";

const PAGE_SIZE = 24;

const SORTS: { value: MediaSort; label: string }[] = [
  { value: "size", label: "体积优先" },
  { value: "recent", label: "最新入库" },
];

export default function MediaManager() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<MediaSort>("size");
  const [albumId, setAlbumId] = useState("");

  const params = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
    sort,
  });
  if (albumId) params.set("albumId", albumId);

  const { data, error, loading, reload } = useAdminData<MediaOverview>(
    `/api/admin/media?${params.toString()}`,
  );

  function changeSort(next: MediaSort) {
    setSort(next);
    setPage(1);
  }

  function changeAlbum(next: string) {
    setAlbumId(next);
    setPage(1);
  }

  const items = data?.items ?? [];
  const stats = data?.stats;
  const largestId = stats?.largest?.id ?? null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Library"
        title="媒体库"
        description="全站照片的体积、尺寸与格式一览。按体积排序可以快速找出拖慢首屏的巨图；这里只读，增删改仍在相册编辑页。"
        actions={
          <>
            <Select
              aria-label="按相册筛选"
              className="h-9 w-40"
              value={albumId}
              onChange={(event) => changeAlbum(event.target.value)}
            >
              <option value="">全部相册</option>
              {(data?.albumOptions ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </Select>
            <div className="flex rounded-xl border border-slate-200/80 dark:border-white/10 p-1">
              {SORTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeSort(option.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    sort === option.value
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
              刷新
            </Button>
          </>
        }
      />

      {error ? (
        <div className="space-y-2">
          <AdminError message={error} />
          <Button variant="outline" size="sm" onClick={reload}>
            重试
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="照片总数" value={stats ? String(stats.count) : "—"} hint="全站，不受筛选影响" />
        <StatCard label="已记录体积" value={stats ? formatBytes(stats.bytes) : "—"} hint="只统计有元数据的照片" />
        <StatCard
          label="未记录元数据"
          value={stats ? String(stats.missingBytes) : "—"}
          hint="上传记录体积之前入库的老照片"
          warn={Boolean(stats && stats.missingBytes > 0)}
        />
        <StatCard
          label="最大单图"
          value={stats?.largest ? formatBytes(stats.largest.bytes) : "—"}
          hint={stats?.largest?.caption || stats?.largest?.album_title || "暂无数据"}
        />
      </div>

      {stats && stats.missingBytes > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          有 {stats.missingBytes} 张照片没有体积记录，它们是补元数据之前入库的。重新上传一次即可补齐，统计口径不会被它们污染。
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>照片</CardTitle>
          <span className="text-xs text-slate-500">
            {data ? `共 ${data.total} 张` : ""}
          </span>
        </CardHeader>

        {loading && !data ? (
          <CardContent>
            <p className="py-16 text-center text-sm text-slate-500">正在读取…</p>
          </CardContent>
        ) : items.length === 0 ? (
          <AdminEmptyState
            title="这里还没有照片"
            description="先在「相册」里建一个相册并上传图片，媒体库会自动汇总它们的体积与尺寸。"
            action={
              <Link
                href="/admin/albums"
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-900 underline-offset-4 hover:underline dark:text-white"
              >
                去相册管理
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
        ) : (
          <CardContent>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  isLargest={item.id === largestId}
                />
              ))}
            </ul>
          </CardContent>
        )}

        {data && data.total > PAGE_SIZE ? (
          <AdminPagination
            page={data.page}
            pageSize={data.size}
            total={data.total}
            onPageChange={setPage}
          />
        ) : null}
      </Card>

      {data && data.albums.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>相册占用</CardTitle>
            <span className="text-xs text-slate-500">按照片数量排序</span>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {data.albums.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => changeAlbum(String(row.id))}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition",
                      String(row.id) === albumId
                        ? "border-slate-900/20 bg-slate-900/5 dark:border-white/20 dark:bg-white/10"
                        : "border-slate-200/80 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5",
                    )}
                  >
                    <span className="truncate text-sm text-slate-800 dark:text-slate-200">
                      {row.title}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {row.count} 张 · {row.bytes === null ? "未记录" : formatBytes(row.bytes)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  warn = false,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p
          className={cn(
            "text-xl font-semibold tracking-tight",
            warn ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white",
          )}
        >
          {value}
        </p>
        {hint ? <p className="truncate text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function MediaCard({ item, isLargest }: { item: MediaItem; isLargest: boolean }) {
  const name = item.url.split("/").pop() ?? item.url;
  const dimensions =
    item.width && item.height ? `${item.width}×${item.height}` : "尺寸未记录";

  return (
    <li className="group overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="relative block aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-white/5"
      >
        <img
          src={item.url}
          alt={item.caption || name}
          loading="lazy"
          className="size-full object-cover transition duration-300 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          {isLargest ? (
            <Badge variant="warning">最大</Badge>
          ) : null}
          {item.format ? <Badge variant="muted">{item.format}</Badge> : null}
        </span>
        <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {item.bytes === null ? "体积未记录" : formatBytes(item.bytes)}
        </span>
      </a>
      <div className="space-y-1 px-3 py-2.5">
        <p className="truncate text-sm text-slate-800 dark:text-slate-200" title={item.caption || item.url}>
          {item.caption || name}
        </p>
        <p className="truncate text-xs text-slate-500">
          {dimensions} · {item.album_title}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-600">
          {item.created_at ? formatDateTime(item.created_at) : "入库时间未记录"}
        </p>
      </div>
    </li>
  );
}
