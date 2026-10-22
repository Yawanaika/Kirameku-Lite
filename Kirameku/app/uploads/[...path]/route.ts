import { handle } from "@/server/http/handler";
import { getUploadRoot } from "@/server/storage";
import { readLocalImage } from "@/server/storage/local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve files written by the local storage fallback.
 *
 * Production uses this handler: the bundled Caddy container proxies every
 * request, including `/uploads/*`, to the app. A host-level proxy may alias
 * `UPLOAD_DIR` instead, but the app must work standalone. Only image
 * extensions are served, with `nosniff` and no inline HTML/SVG, so an uploaded
 * file cannot become an XSS vector on the site origin.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handle(
    async () => {
      const { path: segments } = await params;
      const { body, contentType } = await readLocalImage(
        getUploadRoot(),
        segments ?? [],
      );

      return new Response(new Uint8Array(body), {
        headers: {
          "content-type": contentType,
          "content-length": String(body.byteLength),
          "x-content-type-options": "nosniff",
          "content-disposition": "inline",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    },
    { request },
  );
}
