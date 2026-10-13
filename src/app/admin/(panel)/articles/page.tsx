import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { effectiveStatus } from "@/lib/admin/content";
import { parseListParams, statusWhere, orderBy, ADMIN_PAGE_SIZE } from "@/lib/admin/list-query";
import { PageHeader } from "@/components/admin/page-header";
import { NewContentButton } from "@/components/admin/new-content-button";
import { ImportMarkdownButton } from "@/components/admin/import-markdown-button";
import { ListFilters } from "@/components/admin/list-filters";
import { ContentTable } from "@/components/admin/content-table";
import { AdminPagination } from "@/components/admin/admin-pagination";

export const metadata = { title: "Articles" };

export default async function AdminArticlesPage({ searchParams }: PageProps<"/admin/articles">) {
  const p = parseListParams(await searchParams);
  const where: Prisma.ArticleWhereInput = {
    ...statusWhere(p.status),
    ...(p.q ? { OR: [{ title: { contains: p.q, mode: "insensitive" } }, { slug: { contains: p.q, mode: "insensitive" } }] } : {}),
    ...(p.tag ? { tags: { some: { slug: p.tag } } } : {}),
    ...(p.category ? { category: { slug: p.category } } : {}),
  };
  const [rows, total, tags, categories] = await Promise.all([
    prisma.article.findMany({
      where, orderBy: orderBy(p.sort), skip: (p.page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE,
      select: {
        id: true, title: true, slug: true, status: true, publishedAt: true, updatedAt: true,
        tags: { select: { name: true } }, category: { select: { name: true } }, _count: { select: { comments: true } },
      },
    }),
    prisma.article.count({ where }),
    prisma.tag.findMany({ where: { articles: { some: {} } }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="Articles" description="Long-form articles shown on /articles.">
        <ImportMarkdownButton type="article" />
        <NewContentButton type="article" label="New article" />
      </PageHeader>
      <ListFilters action="/admin/articles" values={{ q: p.q, status: p.status, tag: p.tag, category: p.category, sort: p.sort }} statuses={["draft", "published", "scheduled"]} categories={categories} tags={tags} />
      <ContentTable
        type="article"
        rows={rows.map((r) => ({
          id: r.id, title: r.title, status: effectiveStatus(r.status, r.publishedAt), date: r.publishedAt?.toISOString() ?? null,
          updatedAt: r.updatedAt.toISOString(), tags: r.tags.map((t) => t.name), category: r.category?.name ?? null,
          comments: r._count.comments, url: `/articles/${r.slug}`,
        }))}
      />
      <AdminPagination base="/admin/articles" params={{ q: p.q, status: p.status, tag: p.tag, category: p.category, sort: p.sort }} page={p.page} total={total} perPage={ADMIN_PAGE_SIZE} />
    </div>
  );
}
