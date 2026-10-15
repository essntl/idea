import Link from "next/link";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/guard";
import { commentedPosts, listAdminComments, postFilterWhere } from "@/lib/admin/comments-query";
import { PostFilter } from "@/components/admin/post-filter";
import { PageHeader } from "@/components/admin/page-header";
import { CommentsModeration } from "@/components/admin/comments-moderation";
import { AdminPagination } from "@/components/admin/admin-pagination";

export const metadata = { title: "Comments" };

const FILTERS = ["all", "pending", "hidden", "deleted"] as const;
const PER_PAGE = 50;

const params = z.object({
  // "visible" is kept for old links; it's shown as "All".
  filter: z.enum([...FILTERS, "visible"]).catch("all"),
  post: z.string().max(60).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});

export default async function CommentsPage({ searchParams }: PageProps<"/admin/comments">) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const p = params.parse({ filter: sp.filter ?? "all", post: sp.post || undefined, page: sp.page ?? 1 });
  const filter = p.filter === "visible" ? "all" : p.filter;
  const where: Prisma.CommentWhereInput = {
    ...(filter === "all" ? { status: { not: "deleted" } } : { status: filter }),
    ...postFilterWhere(p.post),
  };
  const [comments, total, counts, posts] = await Promise.all([
    listAdminComments(where, PER_PAGE, (p.page - 1) * PER_PAGE),
    prisma.comment.count({ where }),
    prisma.comment.groupBy({ by: ["status"], _count: true }),
    commentedPosts(),
  ]);
  // Visiting this page marks comments as seen for the dashboard counter.
  await prisma.user.update({ where: { id: admin.id }, data: { lastSeenCommentsAt: new Date() } });
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const labels: Record<(typeof FILTERS)[number], string> = { all: "All", pending: "Pending", hidden: "Hidden", deleted: "Deleted" };
  const badge: Partial<Record<(typeof FILTERS)[number], number>> = { pending: count("pending"), hidden: count("hidden") };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Comments" />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Filter comments" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
          <div className="inline-flex gap-1 rounded-full bg-surface p-1">
            {FILTERS.map((f) => (
              <Link
                key={f}
                href={`/admin/comments?filter=${f}${p.post ? `&post=${encodeURIComponent(p.post)}` : ""}`}
                aria-current={filter === f ? "page" : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm whitespace-nowrap ${filter === f ? "bg-bg font-medium text-fg shadow-sm" : "text-muted hover:text-fg"}`}
              >
                {labels[f]}
                {!!badge[f] && <span className="rounded-full bg-fg px-1.5 text-[0.7rem] font-semibold text-bg">{badge[f]}</span>}
              </Link>
            ))}
          </div>
        </nav>
        <PostFilter filter={filter} value={p.post ?? ""} options={posts} />
      </div>
      <CommentsModeration comments={comments} />
      <AdminPagination base="/admin/comments" params={{ filter, post: p.post }} page={p.page} total={total} perPage={PER_PAGE} />
    </div>
  );
}
