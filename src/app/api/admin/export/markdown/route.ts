import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import { adminRoute, HttpError } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { exportMarkdown } from "@/lib/markdown";
import { siteUrl } from "@/lib/env";

const query = z.object({ type: z.enum(["blog", "article", "page"]), id: z.string().min(1).max(40) });

export const GET = adminRoute(async (req) => {
  const { type, id } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  let md: string;
  let name: string;
  if (type === "blog") {
    const p = await prisma.blogPost.findUnique({ where: { id }, include: { tags: true } });
    if (!p) throw new HttpError(404, "Not found");
    md = exportMarkdown(p.contentJson as JSONContent, {
      title: p.title, description: p.description, date: p.publishedAt?.toISOString(), tags: p.tags.map((t) => t.name),
    });
    name = p.slug;
  } else if (type === "article") {
    const a = await prisma.article.findUnique({ where: { id }, include: { tags: true, category: true, previewImage: true } });
    if (!a) throw new HttpError(404, "Not found");
    md = exportMarkdown(a.contentJson as JSONContent, {
      title: a.title, description: a.excerpt, slug: a.slug, date: a.publishedAt?.toISOString(), category: a.category?.name,
      tags: a.tags.map((t) => t.name), image: a.previewImage ? `${siteUrl()}/media/${a.previewImage.path}` : null,
    });
    name = a.slug;
  } else {
    const p = await prisma.page.findUnique({ where: { key: id } });
    if (!p) throw new HttpError(404, "Not found");
    md = exportMarkdown(p.contentJson as JSONContent, { title: p.title });
    name = p.key;
  }
  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${name.replace(/[^\w.-]/g, "_") || "export"}.md"`,
      "cache-control": "no-store",
    },
  });
});
