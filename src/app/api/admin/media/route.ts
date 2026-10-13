import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, HttpError } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { createMedia, toMediaItem } from "@/lib/admin/media-service";
import { MediaError, maxUploadBytes } from "@/lib/media";

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  q: z.string().max(200).optional(),
  perPage: z.coerce.number().int().min(1).max(100).default(40),
});

export const GET = adminRoute(async (req) => {
  const { page, q, perPage } = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const where = q ? { OR: [{ filename: { contains: q, mode: "insensitive" as const } }, { alt: { contains: q, mode: "insensitive" as const } }] } : {};
  const [rows, total] = await Promise.all([
    prisma.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
    prisma.media.count({ where }),
  ]);
  return NextResponse.json({ items: rows.map(toMediaItem), total, page, perPage });
});

/** Multipart upload: one or more `file` fields, optional `alt`. */
export const POST = adminRoute(async (req) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxUploadBytes() * 10 + 1024 * 1024) throw new HttpError(413, "Upload too large");
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Expected multipart form data");
  });
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) throw new HttpError(400, "No file uploaded");
  const alt = z.string().max(500).catch("").parse(form.get("alt") ?? "");
  const items = [];
  const errors: { filename: string; error: string }[] = [];
  for (const file of files.slice(0, 20)) {
    if (file.size > maxUploadBytes()) {
      errors.push({ filename: file.name, error: `Larger than ${process.env.MAX_UPLOAD_MB || 15} MB` });
      continue;
    }
    try {
      const media = await createMedia(Buffer.from(await file.arrayBuffer()), file.name, alt);
      items.push(toMediaItem(media));
    } catch (err) {
      if (err instanceof MediaError) errors.push({ filename: file.name, error: err.message });
      else throw err;
    }
  }
  if (!items.length) return NextResponse.json({ error: errors[0]?.error ?? "Upload failed", errors }, { status: 400 });
  return NextResponse.json({ items, errors }, { status: 201 });
});
