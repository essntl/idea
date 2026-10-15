import { NextResponse } from "next/server";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { updateProject } from "@/lib/admin/content";
import { prisma } from "@/lib/db";
import { revalidate } from "@/lib/revalidate";

type Ctx = RouteContext<"/api/admin/projects/[id]">;

export const PUT = adminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const p = await updateProject(id, await readJson(req));
  revalidate("content", "redirects");
  return NextResponse.json({ id: p.id, slug: p.slug, status: p.status, publishedAt: p.publishedAt, updatedAt: p.updatedAt });
});

/** Linked posts stay; they just lose their project link. */
export const DELETE = adminRoute<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await prisma.project.delete({ where: { id } }).catch(() => {
    throw new HttpError(404, "Project not found");
  });
  revalidate("content");
  return NextResponse.json({ ok: true });
});
