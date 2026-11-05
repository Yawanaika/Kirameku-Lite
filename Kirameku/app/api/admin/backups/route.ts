import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { readBackupOverview } from "@/server/modules/backups";

export const dynamic = "force-dynamic";

/**
 * 备份快照的只读视图。
 *
 * 只读是刻意的：恢复必须停服并替换 SQLite 文件（`pnpm db:restore`），
 * 放在后台的按钮里点错一次就是事故。这里只回答「备份还在跑吗、占多大、
 * 磁盘还剩多少」。
 */
export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      return readBackupOverview();
    },
    { request },
  );
}
