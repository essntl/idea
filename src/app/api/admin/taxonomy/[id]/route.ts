import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { SLUG_PATTERN } from "@/lib/slug";
import { revalidate } from "@/lib/revalidate";

type Ctx = RouteContext<"/api/admin/taxonomy/[id]">;

const updateSchema = z.object({
  kind: z.enum(["category", "tag"]),
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().regex(SLUG_PATTERN, "Invalid slug").max(80),
  description: z.string().trim().max(500).optional(),
});

export const PUT = adminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const input = updateSchema.parse(await readJson(req));
  try {
    const item =
      input.kind === "category"
        ? await prisma.category.update({ where: { id }, data: { name: input.name, slug: input.slug, description: input.description ?? "" } })
        : await prisma.tag.update({ where: { id }, data: { name: input.name, slug: input.slug } });
    revalidate("content");
    return NextResponse.json({ item });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new HttpError(409, "Name or slug already in use");
    if ((err as { code?: string }).code === "P2025") throw new HttpError(404, "Not found");
    throw err;
  }
});

/** Deleting a category leaves its articles uncategorised; deleting a tag removes it from posts. */
export const DELETE = adminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const kind = z.enum(["category", "tag"]).parse(new URL(req.url).searchParams.get("kind"));
  const op = kind === "category" ? prisma.category.delete({ where: { id } }) : prisma.tag.delete({ where: { id } });
  await op.catch(() => {
    throw new HttpError(404, "Not found");
  });
  revalidate("content");
  return NextResponse.json({ ok: true });
});
