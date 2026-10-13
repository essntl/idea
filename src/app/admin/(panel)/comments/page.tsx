import Link from "next/link";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/guard";
import { listAdminComments } from "@/lib/admin/comments-query";
import { PageHeader } from "@/components/admin/page-header";
import { CommentsModeration } from "@/components/admin/comments-moderation";
import { AdminPagination } from "@/components/admin/admin-pagination";

export const metadata = { title: "Comments" };

const FILTERS = ["all", "pending", "visible", "hidden", "deleted"] as const;
const PER_PAGE = 50;

const params = z.object({
  filter: z.enum(FILTERS).catch("all"),
  article: z.string().max(40).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});

export default async function CommentsPage({ searchParams }: PageProps<"/admin/comments">) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const p = params.parse({ filter: sp.filter ?? "all", article: sp.article || undefined, page: sp.page ?? 1 });
  const where: Prisma.CommentWhereInput = {
    ...(p.filter === "all" ? { status: { not: "deleted" } } : { status: p.filter }),
    ...(p.article ? { articleId: p.article } : {}),
  };
  const [comments, total, counts, articles] = await Promise.all([
    listAdminComments(where, PER_PAGE, (p.page - 1) * PER_PAGE),
    prisma.comment.count({ where }),
    prisma.comment.groupBy({ by: ["status"], _count: true }),
    prisma.article.findMany({ where: { comments: { some: {} } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  // Visiting this page marks comments as seen for the dashboard counter.
  await prisma.user.update({ where: { id: admin.id }, data: { lastSeenCommentsAt: new Date() } });
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const label: Record<(typeof FILTERS)[number], string> = {
    all: "All", pending: `Pending (${count("pending")})`, visible: "Visible", hidden: `Hidden (${count("hidden")})`, deleted: "Deleted",
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Comments" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter comments" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={`/admin/comments?filter=${f}${p.article ? `&article=${p.article}` : ""}`}
              aria-current={p.filter === f ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-3 text-sm ${p.filter === f ? "border-fg bg-fg text-bg" : "border-line-strong text-muted hover:text-fg"}`}
            >
              {label[f]}
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/comments" className="flex gap-2">
          <input type="hidden" name="filter" value={p.filter} />
          <label htmlFor="article-filter" className="sr-only">Article</label>
          <select id="article-filter" name="article" defaultValue={p.article ?? ""} className="field sm:w-56">
            <option value="">All articles</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>{a.title || "Untitled"}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-ghost">Go</button>
        </form>
      </div>
      <CommentsModeration comments={comments} />
      <AdminPagination base="/admin/comments" params={{ filter: p.filter, article: p.article }} page={p.page} total={total} perPage={PER_PAGE} />
    </div>
  );
}
