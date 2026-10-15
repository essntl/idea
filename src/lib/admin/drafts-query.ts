import { prisma } from "../db";

export type InProgressItem = {
  key: string;
  type: "Blog post" | "Article" | "Project" | "Page";
  title: string;
  /** "draft" = never published; "edits" = live post with unpublished changes. */
  state: "draft" | "edits";
  at: string;
  href: string;
};

/** Work in progress for the dashboard: unpublished drafts and live content with pending edits, newest first. */
export async function listInProgress(limit = 8): Promise<InProgressItem[]> {
  const where = { OR: [{ status: "draft" as const }, { draftUpdatedAt: { not: null } }] };
  const select = { id: true, title: true, status: true, updatedAt: true, draftUpdatedAt: true } as const;
  const [posts, articles, projects, pages] = await Promise.all([
    prisma.blogPost.findMany({ where, select, orderBy: { updatedAt: "desc" }, take: limit }),
    prisma.article.findMany({ where, select, orderBy: { updatedAt: "desc" }, take: limit }),
    prisma.project.findMany({ where, select, orderBy: { updatedAt: "desc" }, take: limit }),
    prisma.page.findMany({ where: { draftUpdatedAt: { not: null } }, select: { key: true, title: true, draftUpdatedAt: true } }),
  ]);
  const items: InProgressItem[] = [
    ...posts.map((p) => ({
      key: `blog:${p.id}`, type: "Blog post" as const, title: p.title, state: p.status === "draft" ? ("draft" as const) : ("edits" as const),
      at: (p.draftUpdatedAt ?? p.updatedAt).toISOString(), href: `/admin/blog/${p.id}`,
    })),
    ...articles.map((a) => ({
      key: `article:${a.id}`, type: "Article" as const, title: a.title, state: a.status === "draft" ? ("draft" as const) : ("edits" as const),
      at: (a.draftUpdatedAt ?? a.updatedAt).toISOString(), href: `/admin/articles/${a.id}`,
    })),
    ...projects.map((p) => ({
      key: `project:${p.id}`, type: "Project" as const, title: p.title, state: p.status === "draft" ? ("draft" as const) : ("edits" as const),
      at: (p.draftUpdatedAt ?? p.updatedAt).toISOString(), href: `/admin/projects/${p.id}`,
    })),
    ...pages.map((p) => ({
      key: `page:${p.key}`, type: "Page" as const, title: p.title || p.key, state: "edits" as const,
      at: p.draftUpdatedAt!.toISOString(), href: `/admin/${p.key}`,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
