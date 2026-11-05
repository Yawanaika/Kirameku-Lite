"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import { useConfirm } from "./ConfirmProvider";
import { useAdminData } from "./use-admin-data";
import { adminRequest, describeAdminError } from "./admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatBytes,
  formatDateTime,
  formatElapsed,
  formatRelativeTime,
} from "@/lib/format";
import type {
  BackupDeleteResult,
  BackupOverview,
} from "@/server/modules/backups/contracts";

const PATH = "/api/admin/backups";

/** 展示最近这么多组快照；保留策略下通常是 14 天日备 + 8 个周备。 */
const MAX_ROWS = 20;

/** 勾选框样式，与其它后台列表保持一致。 */
const CHECKBOX_CLASS =
  "size-3.5 rounded border-slate-300/80 bg-slate-950 accent-sky-400 dark:border-white/20";

function diskTone(ratio: number): {
  label: string;
  variant: "success" | "warning" | "danger";
} {
  if (ratio >= 0.95) return { label: "空间严重不足", variant: "danger" };
  if (ratio >= 0.85) return { label: "空间偏紧", variant: "warning" };
  return { label: "空间充足", variant: "success" };
}

function FreshnessCard({ data }: { data: BackupOverview }) {
  const stale = data.stale;
  const age = data.latestAgeSeconds;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {stale ? (
            <AlertTriangle className="size-4 text-amber-400" aria-hidden />
          ) : (
            <CheckCircle2 className="size-4 text-emerald-400" aria-hidden />
          )}
          最新快照
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={stale ? "danger" : "success"}>
            {age === null
              ? "没有备份"
              : stale
                ? `已过期（${Math.floor(age / 3600)} 小时前）`
                : `正常（${formatElapsed(age)}）`}
          </Badge>
          <span className="text-xs text-slate-500">
            超过 {data.staleAfterHours} 小时没有新备份记为过期
          </span>
        </div>
        <dl className="grid gap-2 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">最新文件</dt>
            <dd
              className="truncate font-mono text-[11px] text-slate-700 dark:text-slate-300"
              title={data.latestFile ?? undefined}
            >
              {data.latestFile ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">备份目录</dt>
            <dd
              className="truncate font-mono text-[11px] text-slate-700 dark:text-slate-300"
              title={data.dir}
            >
              {data.dir}
            </dd>
          </div>
        </dl>
        {data.unreadable ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
            备份目录不存在或不可读。检查 BACKUP_DIR，以及容器里是否挂载了 ./backup。
          </p>
        ) : null}
        <p className="text-[11px] leading-5 text-slate-500">
          保留策略：最近 {data.retention.dailyDays} 天全部保留，更早的按周各留一份
          （最多 {data.retention.weeklyCount} 份）。这里只允许删除，恢复仍走停服的 pnpm
          db:restore。
        </p>
      </CardContent>
    </Card>
  );
}

function StatsCard({ data }: { data: BackupOverview }) {
  const disk = data.disk;
  const ratio = disk ? disk.usedBytes / Math.max(disk.totalBytes, 1) : 0;
  const tone = diskTone(ratio);

  return (
    <Card>
      <CardHeader>
        <CardTitle>占用与磁盘</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-slate-500">备份组</dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
              {data.counts.groups}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">总占用</dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
              {formatBytes(data.totalBytes)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">数据库快照</dt>
            <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-300">
              {data.counts.databases} 个
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">图片归档</dt>
            <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-300">
              {data.counts.uploadsArchives} 个
            </dd>
          </div>
        </dl>

        {disk ? (
          <div className="space-y-1.5 border-t border-slate-200/70 pt-3 dark:border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">磁盘（数据目录）</span>
              <Badge variant={tone.variant}>{tone.label}</Badge>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
              role="img"
              aria-label={`磁盘已用 ${Math.round(ratio * 100)}%`}
            >
              <div
                className={`h-full rounded-full ${ratio >= 0.95 ? "bg-rose-500" : ratio >= 0.85 ? "bg-amber-400" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              剩余 {formatBytes(disk.availableBytes)} / 共{" "}
              {formatBytes(disk.totalBytes)}
            </p>
          </div>
        ) : (
          <p className="border-t border-slate-200/70 pt-3 text-[11px] text-slate-500 dark:border-white/5">
            无法读取磁盘信息（当前运行环境不支持 statfs）。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function BackupsManager() {
  const { data, loading, error, reload } = useAdminData<BackupOverview>(PATH);
  const confirm = useConfirm();
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visibleGroups = data ? data.groups.slice(0, MAX_ROWS) : [];
  const visibleStamps = visibleGroups.map((group) => group.stamp);
  const allVisibleSelected =
    visibleStamps.length > 0 &&
    visibleStamps.every((stamp) => selected.includes(stamp));

  function toggleStamp(stamp: string, checked: boolean) {
    setSelected((previous) =>
      checked
        ? previous.includes(stamp)
          ? previous
          : [...previous, stamp]
        : previous.filter((value) => value !== stamp),
    );
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((previous) =>
      checked
        ? [...new Set([...previous, ...visibleStamps])]
        : previous.filter((stamp) => !visibleStamps.includes(stamp)),
    );
  }

  async function removeStamps(stamps: string[]) {
    if (stamps.length === 0) return;

    const groups = (data?.groups ?? []).filter((group) =>
      stamps.includes(group.stamp),
    );
    const bytes = groups.reduce((sum, group) => sum + group.totalBytes, 0);
    const latestDatabaseStamp =
      data?.groups.find((group) => group.database !== null)?.stamp ?? null;

    const lines = [
      `确定删除 ${groups.length} 组快照（共 ${formatBytes(bytes)}）？`,
    ];
    if (groups.some((group) => group.database !== null)) {
      lines.push("数据库快照删除后无法从后台恢复。");
    }
    if (latestDatabaseStamp !== null && stamps.includes(latestDatabaseStamp)) {
      lines.push("注意：这组是最新的数据库快照，删完就没有可恢复的备份了。");
    }
    if (!await confirm(lines.join("\n"))) return;

    setRemoving(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await adminRequest<BackupDeleteResult>(PATH, {
        method: "DELETE",
        body: JSON.stringify({ stamps }),
      });
      const freed = result.deleted.reduce((sum, group) => sum + group.bytes, 0);
      const parts = [
        `已删除 ${result.deleted.length} 组快照，释放 ${formatBytes(freed)}。`,
      ];
      if (result.missing.length > 0) {
        parts.push(`${result.missing.length} 组已经不存在。`);
      }
      if (result.failed.length > 0) {
        parts.push(
          `${result.failed.length} 个文件删除失败：${result.failed[0].reason}`,
        );
      }
      setNotice(parts.join(" "));
      setSelected((previous) =>
        previous.filter((stamp) => !stamps.includes(stamp)),
      );
      reload();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Maintenance"
        title="备份"
        description="定时任务每天生成一次数据库快照与图片归档。这里可以检查与清理快照；恢复仍走停服的 pnpm db:restore。"
        actions={
          <div className="flex items-center gap-2">
            {selected.length > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={removing}
                onClick={() => removeStamps(selected)}
              >
                <Trash2 className="size-4" aria-hidden />
                删除选中（{selected.length}）
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw
                className={loading ? "size-4 animate-spin" : "size-4"}
                aria-hidden
              />
              刷新
            </Button>
          </div>
        }
      />

      {error ? <AdminError message={error} /> : null}
      {actionError ? <AdminError message={actionError} /> : null}
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
        >
          {notice}
        </p>
      ) : null}

      {loading && !data ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-slate-500">
            正在读取备份目录…
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <FreshnessCard data={data} />
            <StatsCard data={data} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>快照列表</CardTitle>
            </CardHeader>
            {data.groups.length === 0 ? (
              <AdminEmptyState
                title="备份目录里还没有快照"
                description="确认 scripts/maintenance.sh 的 systemd timer 已安装，或手动执行 pnpm db:backup。"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        className={CHECKBOX_CLASS}
                        aria-label="全选列出的快照"
                        checked={allVisibleSelected}
                        disabled={removing}
                        onChange={(event) =>
                          toggleAllVisible(event.target.checked)
                        }
                      />
                    </TableHead>
                    <TableHead>生成时间</TableHead>
                    <TableHead>距今</TableHead>
                    <TableHead>数据库</TableHead>
                    <TableHead>图片归档</TableHead>
                    <TableHead className="text-right">合计</TableHead>
                    <TableHead className="w-12 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleGroups.map((group) => (
                    <TableRow key={group.stamp}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className={CHECKBOX_CLASS}
                          aria-label={`选择 ${formatDateTime(group.createdAt)} 的快照`}
                          checked={selected.includes(group.stamp)}
                          disabled={removing}
                          onChange={(event) =>
                            toggleStamp(group.stamp, event.target.checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(group.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-500">
                        {formatRelativeTime(group.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {group.database ? (
                          formatBytes(group.databaseBytes)
                        ) : (
                          <span className="text-rose-400">缺失</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-500">
                        {group.uploads ? formatBytes(group.uploadsBytes) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs">
                        {formatBytes(group.totalBytes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={removing}
                          aria-label={`删除 ${formatDateTime(group.createdAt)} 的快照`}
                          onClick={() => removeStamps([group.stamp])}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {data.groups.length > MAX_ROWS ? (
            <p className="text-[11px] text-slate-500">
              仅显示最近 {MAX_ROWS} 组，共 {data.groups.length} 组。
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
