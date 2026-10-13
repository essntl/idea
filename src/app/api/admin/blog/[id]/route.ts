import { NextResponse } from "next/server";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { updateBlogPost } from "@/lib/admin/content";
import { prisma } from "@/lib/db";
import { revalidate } from "@/lib/revalidate";

type Ctx = RouteContext<"/api/admin/blog/[id]">;

export const GET = adminRoute<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const post = await prisma.blogPost.findUnique({ where: { id }, include: { tags: { select: { name: true } } } });
  if (!post) throw new HttpError(404, "Post not found");
  return NextResponse.json(post);
});

export const PUT = adminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const post = await updateBlogPost(id, await readJson(req));
  revalidate("content");
  return NextResponse.json({ id: post.id, slug: post.slug, status: post.status, publishedAt: post.publishedAt, updatedAt: post.updatedAt });
});

export const DELETE = adminRoute<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await prisma.blogPost.delete({ where: { id } }).catch(() => {
    throw new HttpError(404, "Post not found");
  });
  revalidate("content");
  return NextResponse.json({ ok: true });
});
