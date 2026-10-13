/**
 * Read-side data access for public pages. Results are cached (tag-invalidated on admin changes)
 * and returned as plain JSON-safe DTOs (dates as ISO strings).
 */
import { unstable_cache } from "next/cache";
import { prisma } from "./db";
import { TAGS } from "./cache-tags";
import type { Prisma } from "@/generated/prisma/client";
import type { TocItem } from "./content/pipeline";

const SCHEDULE_GRANULARITY_SEC = 60;

/** Visible = published or scheduled, with a publish date that has passed. */
export function visibleWhere(): { status: { in: ("published" | "scheduled")[] }; publishedAt: { lte: Date } } {
  return { status: { in: ["published", "scheduled"] }, publishedAt: { lte: new Date() } };
}

const cached = <A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, tags: string[] = [TAGS.content]) =>
  unstable_cache(fn, [key], { tags, revalidate: SCHEDULE_GRANULARITY_SEC });

export type TagDTO = { name: string; slug: string };
export type MediaDTO = { id: string; url: string; width: number; height: number; alt: string };

function mediaDto(m: { id: string; path: string; width: number; height: number; alt: string } | null): MediaDTO | null {
  return m ? { id: m.id, url: `/media/${m.path}`, width: m.width, height: m.height, alt: m.alt } : null;
}

/* ---------------------------------- Blog --------------------------------- */

export type BlogListItem = { id: string; slug: string; title: string; description: string; publishedAt: string; tags: TagDTO[] };

export const listBlogPosts = cached(
  async (opts: { page: number; perPage: number; tag?: string }): Promise<{ items: BlogListItem[]; total: number }> => {
    const where: Prisma.BlogPostWhereInput = { ...visibleWhere(), ...(opts.tag ? { tags: { some: { slug: opts.tag } } } : {}) };
    const [rows, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: (opts.page - 1) * opts.perPage,
        take: opts.perPage,
        select: { id: true, slug: true, title: true, description: true, publishedAt: true, tags: { select: { name: true, slug: true }, orderBy: { name: "asc" } } },
      }),
      prisma.blogPost.count({ where }),
    ]);
    return { items: rows.map((r) => ({ ...r, publishedAt: r.publishedAt!.toISOString() })), total };
  },
  "blog-list",
);

export type BlogPostDTO = BlogListItem & { contentHtml: string; updatedAt: string };

export const getBlogPost = cached(async (slug: string): Promise<BlogPostDTO | null> => {
  const r = await prisma.blogPost.findFirst({
    where: { slug, ...visibleWhere() },
    include: { tags: { select: { name: true, slug: true }, orderBy: { name: "asc" } } },
  });
  if (!r) return null;
  return {
    id: r.id, slug: r.slug, title: r.title, description: r.description, contentHtml: r.contentHtml,
    publishedAt: r.publishedAt!.toISOString(), updatedAt: r.updatedAt.toISOString(), tags: r.tags,
  };
}, "blog-post");

/* -------------------------------- Articles ------------------------------- */

export type ArticleListItem = {
  id: string; slug: string; title: string; excerpt: string; publishedAt: string; readingTime: number;
  category: { name: string; slug: string } | null; previewImage: MediaDTO | null;
};

const articleListSelect = {
  id: true, slug: true, title: true, excerpt: true, publishedAt: true, readingTime: true,
  category: { select: { name: true, slug: true } },
  previewImage: { select: { id: true, path: true, width: true, height: true, alt: true } },
} satisfies Prisma.ArticleSelect;

type ArticleListRow = Prisma.ArticleGetPayload<{ select: typeof articleListSelect }>;

function articleListItem(r: ArticleListRow): ArticleListItem {
  return { ...r, publishedAt: r.publishedAt!.toISOString(), previewImage: mediaDto(r.previewImage) };
}

export const listArticles = cached(
  async (opts: { page: number; perPage: number; category?: string; tag?: string }): Promise<{ items: ArticleListItem[]; total: number }> => {
    const where: Prisma.ArticleWhereInput = {
      ...visibleWhere(),
      ...(opts.category ? { category: { slug: opts.category } } : {}),
      ...(opts.tag ? { tags: { some: { slug: opts.tag } } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.article.findMany({
        where, orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: (opts.page - 1) * opts.perPage, take: opts.perPage, select: articleListSelect,
      }),
      prisma.article.count({ where }),
    ]);
    return { items: rows.map(articleListItem), total };
  },
  "article-list",
);

export type ArticleDTO = ArticleListItem & {
  contentHtml: string; toc: TocItem[]; updatedAt: string; tags: TagDTO[];
  seoTitle: string | null; seoDescription: string | null; categoryId: string | null;
};

export const getArticle = cached(async (slug: string): Promise<ArticleDTO | null> => {
  const r = await prisma.article.findFirst({
    where: { slug, ...visibleWhere() },
    select: {
      ...articleListSelect, contentHtml: true, toc: true, updatedAt: true, seoTitle: true, seoDescription: true, categoryId: true,
      tags: { select: { name: true, slug: true }, orderBy: { name: "asc" } },
    },
  });
  if (!r) return null;
  return {
    ...articleListItem(r), contentHtml: r.contentHtml, toc: (r.toc as TocItem[]) ?? [], updatedAt: r.updatedAt.toISOString(),
    tags: r.tags, seoTitle: r.seoTitle, seoDescription: r.seoDescription, categoryId: r.categoryId,
  };
}, "article");

export type ArticleLink = { slug: string; title: string };

export const getArticleNeighbours = cached(
  async (publishedAtIso: string, id: string): Promise<{ prev: ArticleLink | null; next: ArticleLink | null }> => {
    const at = new Date(publishedAtIso);
    const vis = visibleWhere();
    const [prev, next] = await Promise.all([
      prisma.article.findFirst({
        where: { ...vis, OR: [{ publishedAt: { lt: at } }, { publishedAt: at, id: { lt: id } }] },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }], select: { slug: true, title: true },
      }),
      prisma.article.findFirst({
        where: { status: vis.status, AND: [{ publishedAt: { lte: vis.publishedAt.lte } }, { OR: [{ publishedAt: { gt: at } }, { publishedAt: at, id: { gt: id } }] }] },
        orderBy: [{ publishedAt: "asc" }, { id: "asc" }], select: { slug: true, title: true },
      }),
    ]);
    return { prev, next };
  },
  "article-neighbours",
);

export const getRelatedArticles = cached(async (categoryId: string | null, excludeId: string): Promise<ArticleListItem[]> => {
  if (!categoryId) return [];
  const rows = await prisma.article.findMany({
    where: { ...visibleWhere(), categoryId, id: { not: excludeId } },
    orderBy: { publishedAt: "desc" }, take: 3, select: articleListSelect,
  });
  return rows.map(articleListItem);
}, "article-related");

/* ------------------------------- Taxonomy -------------------------------- */

export const getCategories = cached(async () => {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { name: true, slug: true, description: true, _count: { select: { articles: { where: visibleWhere() } } } },
  });
  return rows.map((r) => ({ name: r.name, slug: r.slug, description: r.description, count: r._count.articles }));
}, "categories");

export const getCategory = cached(async (slug: string) => {
  return prisma.category.findUnique({ where: { slug }, select: { name: true, slug: true, description: true } });
}, "category");

export const getTag = cached(async (slug: string) => {
  return prisma.tag.findUnique({ where: { slug }, select: { name: true, slug: true } });
}, "tag");

/* -------------------------------- Comments ------------------------------- */

export type CommentNode = {
  id: string; parentId: string | null; authorName: string; body: string; isAdminReply: boolean;
  createdAt: string; removed: boolean; children: CommentNode[];
};

type CommentRow = { id: string; parentId: string | null; authorName: string; body: string; isAdminReply: boolean; createdAt: Date; status: string };

/** Builds the public thread. Hidden/deleted comments are kept as "removed" placeholders only if they have visible replies. */
export function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  for (const r of rows) {
    const visible = r.status === "visible";
    nodes.set(r.id, {
      id: r.id, parentId: r.parentId, createdAt: r.createdAt.toISOString(), isAdminReply: visible && r.isAdminReply,
      authorName: visible ? r.authorName : "", body: visible ? r.body : "", removed: !visible, children: [],
    });
  }
  const roots: CommentNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else if (!n.parentId) roots.push(n);
  }
  const prune = (list: CommentNode[]): CommentNode[] =>
    list
      .map((n) => ({ ...n, children: prune(n.children) }))
      .filter((n) => !n.removed || n.children.length > 0)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return prune(roots);
}

export const getComments = cached(
  async (articleId: string): Promise<{ tree: CommentNode[]; count: number }> => {
    const rows = await prisma.comment.findMany({
      where: { articleId, status: { in: ["visible", "hidden", "deleted"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, parentId: true, authorName: true, body: true, isAdminReply: true, createdAt: true, status: true },
    });
    return { tree: buildCommentTree(rows), count: rows.filter((r) => r.status === "visible").length };
  },
  "comments",
  [TAGS.comments],
);

/* --------------------------------- Pages --------------------------------- */

export const getPage = cached(async (key: string) => {
  const p = await prisma.page.findUnique({ where: { key } });
  return p ? { title: p.title, contentHtml: p.contentHtml, updatedAt: p.updatedAt.toISOString() } : null;
}, "page");

/* ------------------------------- Feeds/SEO ------------------------------- */

export const getSitemapEntries = cached(async () => {
  const [articles, posts, categories, tags] = await Promise.all([
    prisma.article.findMany({ where: visibleWhere(), select: { slug: true, updatedAt: true } }),
    prisma.blogPost.findMany({ where: visibleWhere(), select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { articles: { some: visibleWhere() } }, select: { slug: true } }),
    prisma.tag.findMany({ where: { OR: [{ articles: { some: visibleWhere() } }, { blogPosts: { some: visibleWhere() } }] }, select: { slug: true } }),
  ]);
  const iso = <T extends { updatedAt: Date }>(xs: T[]) => xs.map((x) => ({ ...x, updatedAt: x.updatedAt.toISOString() }));
  return { articles: iso(articles), posts: iso(posts), categories, tags };
}, "sitemap");

export type FeedItem = { title: string; url: string; description: string; publishedAt: string; html: string; kind: "article" | "blog" };

export const getFeedItems = cached(async (limit: number): Promise<FeedItem[]> => {
  const [articles, posts] = await Promise.all([
    prisma.article.findMany({ where: visibleWhere(), orderBy: { publishedAt: "desc" }, take: limit, select: { slug: true, title: true, excerpt: true, publishedAt: true, contentHtml: true } }),
    prisma.blogPost.findMany({ where: visibleWhere(), orderBy: { publishedAt: "desc" }, take: limit, select: { slug: true, title: true, description: true, publishedAt: true, contentHtml: true } }),
  ]);
  return [
    ...articles.map((a) => ({ kind: "article" as const, title: a.title, url: `/articles/${a.slug}`, description: a.excerpt, publishedAt: a.publishedAt!.toISOString(), html: a.contentHtml })),
    ...posts.map((p) => ({ kind: "blog" as const, title: p.title, url: `/blog/${p.slug}`, description: p.description, publishedAt: p.publishedAt!.toISOString(), html: p.contentHtml })),
  ]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}, "feed");

/* -------------------------------- Redirects ------------------------------- */

export const getRedirectMap = unstable_cache(
  async (): Promise<Record<string, { to: string; status: number }>> => {
    const rows = await prisma.redirect.findMany({ select: { fromPath: true, toPath: true, statusCode: true } });
    return Object.fromEntries(rows.map((r) => [r.fromPath, { to: r.toPath, status: r.statusCode }]));
  },
  ["redirect-map"],
  { tags: [TAGS.redirects], revalidate: 300 },
);
