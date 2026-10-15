import { prisma } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import type { AdminComment } from "@/components/admin/comment-row";

export async function listAdminComments(where: Prisma.CommentWhereInput, take: number, skip = 0): Promise<AdminComment[]> {
  const rows = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    skip,
    include: {
      article: { select: { id: true, title: true, slug: true } },
      blogPost: { select: { id: true, title: true, slug: true } },
      parent: { select: { authorName: true, body: true, status: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    bodyHtml: r.bodyHtml,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    isAdminReply: r.isAdminReply,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    target: r.article
      ? { kind: "article", title: r.article.title, url: `/articles/${r.article.slug}`, editUrl: `/admin/articles/${r.article.id}` }
      : { kind: "blog", title: r.blogPost?.title ?? "", url: `/blog/${r.blogPost?.slug}`, editUrl: `/admin/blog/${r.blogPost?.id}` },
    parent: r.parent,
  }));
}

/** Articles and blog posts that have comments, for the moderation filter. Values are "article:<id>" / "blog:<id>". */
export async function commentedPosts() {
  const [articles, posts] = await Promise.all([
    prisma.article.findMany({ where: { comments: { some: {} } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.blogPost.findMany({ where: { comments: { some: {} } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  return [
    ...articles.map((a) => ({ value: `article:${a.id}`, label: a.title || "Untitled", hint: "Article" })),
    ...posts.map((p) => ({ value: `blog:${p.id}`, label: p.title || "Untitled", hint: "Blog post" })),
  ];
}

/** Parses the moderation filter value into a Prisma where clause. */
export function postFilterWhere(value: string | undefined): Prisma.CommentWhereInput {
  const m = value?.match(/^(article|blog):([\w-]{1,40})$/);
  if (!m) return {};
  return m[1] === "article" ? { articleId: m[2] } : { blogPostId: m[2] };
}
