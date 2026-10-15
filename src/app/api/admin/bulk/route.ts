import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { revalidate } from "@/lib/revalidate";

const schema = z.object({
  type: z.enum(["blog", "article", "project"]),
  action: z.enum(["delete", "publish", "unpublish"]),
  ids: z.array(z.string().max(40)).min(1).max(500),
});

/** The three content tables share the columns bulk actions touch. */
function table(type: z.infer<typeof schema>["type"]) {
  const t = type === "blog" ? prisma.blogPost : type === "article" ? prisma.article : prisma.project;
  return t as unknown as {
    deleteMany: (a: { where: object }) => Promise<{ count: number }>;
    updateMany: (a: { where: object; data: object }) => Promise<{ count: number }>;
  };
}

/** Bulk delete / publish / unpublish for content lists. */
export const POST = adminRoute(async (req) => {
  const { type, action, ids } = schema.parse(await readJson(req));
  const where = { id: { in: ids } };
  const t = table(type);
  let count = 0;
  if (action === "delete") count = (await t.deleteMany({ where })).count;
  else if (action === "unpublish") count = (await t.updateMany({ where, data: { status: "draft" } })).count;
  else {
    // Keep existing (possibly backdated) dates; set "now" where missing. Titles are required to publish.
    await t.updateMany({ where: { ...where, publishedAt: null }, data: { publishedAt: new Date() } });
    count = (await t.updateMany({ where: { ...where, title: { not: "" } }, data: { status: "published" } })).count;
  }
  revalidate("content", "comments");
  return NextResponse.json({ count });
});
