import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { deleteMedia, mediaUsage, toMediaItem } from "@/lib/admin/media-service";
import { revalidate } from "@/lib/revalidate";

type Ctx = RouteContext<"/api/admin/media/[id]">;

/** Returns the item plus where it is used. */
export const GET = adminRoute<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new HttpError(404, "Not found");
  return NextResponse.json({ item: toMediaItem(media), usage: await mediaUsage(id) });
});

export const PATCH = adminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { alt } = z.object({ alt: z.string().trim().max(500) }).parse(await readJson(req));
  const media = await prisma.media.update({ where: { id }, data: { alt } }).catch(() => {
    throw new HttpError(404, "Not found");
  });
  revalidate("content");
  return NextResponse.json({ item: toMediaItem(media) });
});

/** Refuses to delete an image that is in use unless ?force=1. */
export const DELETE = adminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const usage = await mediaUsage(id);
  if (!usage) throw new HttpError(404, "Not found");
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (usage.length && !force) return NextResponse.json({ error: "Image is in use", usage }, { status: 409 });
  await deleteMedia(id);
  revalidate("content");
  return NextResponse.json({ ok: true });
});
