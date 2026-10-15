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

export const metadata = { title: "Blog posts" };

export default async function AdminBlogPage({ searchParams }: PageProps<"/admin/blog">) {
  const p = parseListParams(await searchParams);
  const where: Prisma.BlogPostWhereInput = {
    ...statusWhere(p.status),
    ...(p.q ? { title: { contains: p.q, mode: "insensitive" } } : {}),
    ...(p.tag ? { tags: { some: { slug: p.tag } } } : {}),
  };
  const [rows, total, tags] = await Promise.all([
    prisma.blogPost.findMany({
      where, orderBy: orderBy(p.sort), skip: (p.page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE,
      select: { id: true, title: true, slug: true, status: true, publishedAt: true, updatedAt: true, draftUpdatedAt: true, tags: { select: { name: true } } },
    }),
    prisma.blogPost.count({ where }),
    prisma.tag.findMany({ where: { blogPosts: { some: {} } }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="Blog posts" description="Diary entries shown on /blog.">
        <NewContentButton type="blog" label="New post" />
        <ImportMarkdownButton type="blog" />
      </PageHeader>
      <ListFilters action="/admin/blog" values={{ q: p.q, status: p.status, tag: p.tag, category: p.category, sort: p.sort }} statuses={["draft", "published", "scheduled"]} tags={tags} />
      <ContentTable
        type="blog"
        rows={rows.map((r) => ({
          id: r.id, title: r.title, status: effectiveStatus(r.status, r.publishedAt), date: r.publishedAt?.toISOString() ?? null,
          updatedAt: (r.draftUpdatedAt ?? r.updatedAt).toISOString(), tags: r.tags.map((t) => t.name), url: `/blog/${r.slug}`, pending: !!r.draftUpdatedAt,
        }))}
      />
      <AdminPagination base="/admin/blog" params={{ q: p.q, status: p.status, tag: p.tag, sort: p.sort }} page={p.page} total={total} perPage={ADMIN_PAGE_SIZE} />
    </div>
  );
}
