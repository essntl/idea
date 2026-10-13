import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { adminRoute, HttpError } from "@/lib/guard";
import { createBackupStream, restoreBackup } from "@/lib/admin/backup";
import { revalidate } from "@/lib/revalidate";

export const maxDuration = 300;

/** Download a full backup (.tar.gz). */
export const GET = adminRoute(async () => {
  const stream = await createBackupStream();
  const name = `blog-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.tar.gz`;
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
});

/** Restore: raw .tar.gz request body. Replaces all content (users are kept). */
export const POST = adminRoute(async (req) => {
  if (!req.body) throw new HttpError(400, "Empty body");
  try {
    const summary = await restoreBackup(Readable.fromWeb(req.body as unknown as NodeWebStream));
    revalidate("content", "comments", "settings", "redirects");
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    throw new HttpError(400, `Restore failed: ${err instanceof Error ? err.message : "invalid archive"}`);
  }
});
