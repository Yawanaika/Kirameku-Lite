import { z } from "zod";
import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

const previewInput = z.object({
  content: z.string().max(200_000),
});

/**
 * Admin-only Markdown preview. Rendering goes through the same server pipeline
 * as the public post page, so the preview is sanitized and highlighted exactly
 * like the published result.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      assertSameOrigin(request);
      await requireAdmin();
      const input = previewInput.parse(await readJson(request));
      return { html: await renderMarkdown(input.content) };
    },
    { request },
  );
}
