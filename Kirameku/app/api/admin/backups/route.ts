import { requireAdmin } from "@/server/auth/guard";
import { errors } from "@/server/http/errors";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  deleteBackupGroups,
  deleteBackupsInput,
  readBackupOverview,
} from "@/server/modules/backups";

export const dynamic = "force-dynamic";

/**
 * 备份快照面板：列出与删除。
 *
 * 恢复仍然缺席是刻意的：恢复要停服并替换 SQLite 文件（`pnpm db:restore`），
 * 放在后台的按钮里点错一次就是事故。这里只回答「备份还在跑吗、占多大、
 * 磁盘还剩多少」，并允许清理过期快照腾出空间。
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

/** 删一组或多组快照；`stamps` 是文件名里的时间戳前缀。 */
export async function DELETE(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();

      const payload = await request.json().catch(() => null);
      if (payload === null) {
        throw errors.badRequest("请求体必须是 JSON");
      }
      const { stamps } = deleteBackupsInput.parse(payload);
      return deleteBackupGroups(stamps);
    },
    { request },
  );
}
