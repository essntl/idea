import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { slugify, SLUG_PATTERN } from "@/lib/slug";
import { revalidate } from "@/lib/revalidate";

const kind = z.enum(["category", "tag"]);

export const GET = adminRoute(async (req) => {
  const k = kind.parse(new URL(req.url).searchParams.get("kind"));
  if (k === "category") {
    const rows = await prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { articles: true } } } });
    return NextResponse.json({ items: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, description: r.description, count: r._count.articles })) });
  }
  const rows = await prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { articles: true, blogPosts: true } } } });
  return NextResponse.json({ items: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r._count.articles + r._count.blogPosts })) });
});

const createSchema = z.object({
  kind,
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
});

export const POST = adminRoute(async (req) => {
  const input = createSchema.parse(await readJson(req));
  const slug = input.slug || slugify(input.name);
  if (!SLUG_PATTERN.test(slug)) throw new HttpError(400, "Invalid slug");
  const model = input.kind === "category" ? prisma.category : prisma.tag;
  const clash = await (model as typeof prisma.tag).findFirst({ where: { OR: [{ slug }, { name: { equals: input.name, mode: "insensitive" } }] } });
  if (clash) {
    // Creating an existing name returns it (handy for "create new" in selects).
    if (clash.name.toLowerCase() === input.name.toLowerCase()) return NextResponse.json({ item: clash });
    throw new HttpError(409, "Slug already in use");
  }
  const item =
    input.kind === "category"
      ? await prisma.category.create({ data: { name: input.name, slug, description: input.description ?? "" } })
      : await prisma.tag.create({ data: { name: input.name, slug } });
  revalidate("content");
  return NextResponse.json({ item }, { status: 201 });
});
