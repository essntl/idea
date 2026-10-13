import { readVariant, resolveMediaPath, fileExists } from "@/lib/media";

/** Serves uploaded images from UPLOAD_DIR. Files are always re-encoded WebP, served inert. */
export async function GET(req: Request, { params }: RouteContext<"/media/[...path]">) {
  const { path } = await params;
  const abs = resolveMediaPath(path);
  if (!abs || !abs.endsWith(".webp") || !(await fileExists(abs))) {
    return new Response("Not found", { status: 404 });
  }
  const w = Number(new URL(req.url).searchParams.get("w"));
  const data = await readVariant(abs, Number.isFinite(w) && w > 0 ? w : null);
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "image/webp",
      "content-length": String(data.byteLength),
      // File names are random and never reused, so they can be cached forever.
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "content-disposition": "inline",
    },
  });
}
