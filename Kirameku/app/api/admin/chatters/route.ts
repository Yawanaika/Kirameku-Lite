import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  adminChatterListQuery,
  createChatterInput,
} from "@/server/modules/chatters/contracts";
import { getChattersService } from "@/server/modules/chatters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = adminChatterListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getChattersService().list(query);
    },
    { request },
  );
}

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const input = createChatterInput.parse(await readJson(request));
      return getChattersService().create(input);
    },
    { request },
  );
}
