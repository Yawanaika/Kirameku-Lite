import { requireAdmin } from "@/server/auth/guard";
import { errors } from "@/server/http/errors";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { assertWritable } from "@/server/http/write-guard";
import { storeImageFile, MAX_IMAGE_BYTES } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);

      const admin = await requireAdmin();
      enforceRateLimit(`upload:image:${admin.id}`, 20, 60 * 60 * 1000);

      const declaredLength = Number(request.headers.get("content-length"));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_IMAGE_BYTES + 64 * 1024
      ) {
        throw errors.payloadTooLarge("图片不能超过 10MB");
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        throw errors.badRequest("无效的上传请求");
      }

      const file = form.get("file");
      if (!(file instanceof File)) {
        throw errors.badRequest("请选择要上传的图片");
      }

      return storeImageFile(file);
    },
    { request },
  );
}
