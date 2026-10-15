import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/guard";
import { docSchema } from "@/lib/admin/content";
import { renderDocument } from "@/lib/content/pipeline";

/** Renders unsaved editor content exactly like a save would (sanitized + highlighted), without storing it. */
export const POST = adminRoute(async (req) => {
  const { contentJson } = z.object({ contentJson: docSchema }).parse(await readJson(req));
  const r = await renderDocument(contentJson);
  return NextResponse.json({ html: r.html, toc: r.toc, readingTime: r.readingTime });
});
