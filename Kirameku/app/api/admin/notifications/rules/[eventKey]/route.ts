import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  ruleEventParams,
  updateRuleInput,
} from "@/server/modules/notifications/contracts";
import { getNotificationsService } from "@/server/modules/notifications";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { eventKey } = ruleEventParams.parse(await params);
      const input = updateRuleInput.parse(await readJson(request));
      return getNotificationsService().updateRule(eventKey, input);
    },
    { request },
  );
}
