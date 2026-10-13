import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { revalidate } from "@/lib/revalidate";

const schema = z.object({
  type: z.enum(["blog", "article"]),
  action: z.enum(["delete", "publish", "unpublish"]),
  ids: z.array(z.string().max(40)).min(1).max(500),
});

/** Bulk delete / publish / unpublish for content lists. */
export const POST = adminRoute(async (req) => {
  const { type, action, ids } = schema.parse(await readJson(req));
  const where = { id: { in: ids } };
  let count = 0;
  if (type === "blog") {
    if (action === "delete") count = (await prisma.blogPost.deleteMany({ where })).count;
    else if (action === "unpublish") count = (await prisma.blogPost.updateMany({ where, data: { status: "draft" } })).count;
    else {
      // Keep existing (possibly backdated) dates; set "now" where missing. Titles are required to publish.
      await prisma.blogPost.updateMany({ where: { ...where, publishedAt: null }, data: { publishedAt: new Date() } });
      count = (await prisma.blogPost.updateMany({ where: { ...where, title: { not: "" } }, data: { status: "published" } })).count;
    }
  } else {
    if (action === "delete") count = (await prisma.article.deleteMany({ where })).count;
    else if (action === "unpublish") count = (await prisma.article.updateMany({ where, data: { status: "draft" } })).count;
    else {
      await prisma.article.updateMany({ where: { ...where, publishedAt: null }, data: { publishedAt: new Date() } });
      count = (await prisma.article.updateMany({ where: { ...where, title: { not: "" } }, data: { status: "published" } })).count;
    }
  }
  revalidate("content", "comments");
  return NextResponse.json({ count });
});
