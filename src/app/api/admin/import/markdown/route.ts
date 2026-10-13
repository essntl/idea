import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, HttpError } from "@/lib/guard";
import { importMarkdownFile, parseMarkdownForEditor, type ImportResult } from "@/lib/admin/import-markdown";

const MAX_MD_BYTES = 2 * 1024 * 1024;

/** Multipart: `type` (blog|article), one or more `file` (.md) and optional `mode=parse`. Each file becomes a draft. */
export const POST = adminRoute(async (req) => {
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Expected multipart form data");
  });
  const type = z.enum(["blog", "article"]).parse(form.get("type"));
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) throw new HttpError(400, "No files");
  // mode=parse: return editor content for the first file without creating a draft.
  if (form.get("mode") === "parse") {
    const file = files[0]!;
    if (file.size > MAX_MD_BYTES) throw new HttpError(400, "File is larger than 2 MB");
    return NextResponse.json(await parseMarkdownForEditor(type, await file.text()));
  }
  const results: ImportResult[] = [];
  const errors: { filename: string; error: string }[] = [];
  for (const file of files.slice(0, 50)) {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      errors.push({ filename: file.name, error: "Not a markdown file" });
      continue;
    }
    if (file.size > MAX_MD_BYTES) {
      errors.push({ filename: file.name, error: "File is larger than 2 MB" });
      continue;
    }
    try {
      results.push(await importMarkdownFile(type, file.name, await file.text()));
    } catch (err) {
      errors.push({ filename: file.name, error: err instanceof Error ? err.message : "Import failed" });
    }
  }
  return NextResponse.json({ results, errors }, { status: results.length ? 201 : 400 });
});
