import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  adminChatterIdParams,
  updateChatterInput,
} from "@/server/modules/chatters/contracts";
import { getChattersService } from "@/server/modules/chatters";
import { revalidateChatters } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      await requireAdmin();
      const { id } = adminChatterIdParams.parse(await params);
      return getChattersService().getById(id);
    },
    { request },
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = adminChatterIdParams.parse(await params);
      const input = updateChatterInput.parse(await readJson(request));
      const result = await getChattersService().update(id, input);
      revalidateChatters();
      return result;
    },
    { request },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = adminChatterIdParams.parse(await params);
      const result = await getChattersService().remove(id);
      revalidateChatters();
      return result;
    },
    { request },
  );
}
