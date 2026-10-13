import { NextResponse } from "next/server";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { updateArticle } from "@/lib/admin/content";
import { prisma } from "@/lib/db";
import { revalidate } from "@/lib/revalidate";

type Ctx = RouteContext<"/api/admin/articles/[id]">;

export const GET = adminRoute<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id }, include: { tags: { select: { name: true } }, previewImage: true } });
  if (!article) throw new HttpError(404, "Article not found");
  return NextResponse.json(article);
});

export const PUT = adminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const a = await updateArticle(id, await readJson(req));
  revalidate("content", "redirects");
  return NextResponse.json({ id: a.id, slug: a.slug, status: a.status, publishedAt: a.publishedAt, updatedAt: a.updatedAt });
});

export const DELETE = adminRoute<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await prisma.article.delete({ where: { id } }).catch(() => {
    throw new HttpError(404, "Article not found");
  });
  revalidate("content", "comments");
  return NextResponse.json({ ok: true });
});
