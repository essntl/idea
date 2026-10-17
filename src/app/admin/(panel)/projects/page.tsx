import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { effectiveStatus } from "@/lib/admin/content";
import { parseListParams, statusWhere, orderBy, ADMIN_PAGE_SIZE } from "@/lib/admin/list-query";
import { PHASE_META } from "@/lib/projects";
import { PageHeader } from "@/components/admin/page-header";
import { NewProjectButton } from "@/components/admin/new-project-button";
import { aiAvailable } from "@/lib/ai/client";
import { ListFilters } from "@/components/admin/list-filters";
import { ContentTable } from "@/components/admin/content-table";
import { AdminPagination } from "@/components/admin/admin-pagination";

export const metadata = { title: "Projects" };

export default async function AdminProjectsPage({ searchParams }: PageProps<"/admin/projects">) {
  const sp = await searchParams;
  const p = parseListParams(sp);
  const where: Prisma.ProjectWhereInput = {
    ...statusWhere(p.status === "scheduled" ? undefined : p.status),
    ...(p.q ? { OR: [{ title: { contains: p.q, mode: "insensitive" } }, { slug: { contains: p.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total, ai] = await Promise.all([
    prisma.project.findMany({
      where, orderBy: orderBy(p.sort), skip: (p.page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE,
      select: {
        id: true, title: true, slug: true, status: true, phase: true, stack: true, publishedAt: true, updatedAt: true, draftUpdatedAt: true,
        _count: { select: { blogPosts: true, articles: true } },
      },
    }),
    prisma.project.count({ where }),
    aiAvailable(),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="Projects" description="Shown on /projects. Link blog posts and articles to a project to show them as progress updates.">
        <NewProjectButton ai={ai} autoOpen={sp.new === "1"} />
      </PageHeader>
      <ListFilters action="/admin/projects" values={{ q: p.q, status: p.status, sort: p.sort }} statuses={["draft", "published"]} />
      <ContentTable
        type="project"
        rows={rows.map((r) => {
          const updates = r._count.blogPosts + r._count.articles;
          return {
            id: r.id, title: r.title, status: effectiveStatus(r.status, r.publishedAt), date: null,
            updatedAt: (r.draftUpdatedAt ?? r.updatedAt).toISOString(), tags: r.stack, pending: !!r.draftUpdatedAt,
            phase: `${PHASE_META[r.phase].label}${updates ? ` · ${updates} update${updates === 1 ? "" : "s"}` : ""}`, url: `/projects/${r.slug}`,
          };
        })}
      />
      <AdminPagination base="/admin/projects" params={{ q: p.q, status: p.status, sort: p.sort }} page={p.page} total={total} perPage={ADMIN_PAGE_SIZE} />
    </div>
  );
}
