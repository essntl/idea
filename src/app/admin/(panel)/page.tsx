import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/guard";
import { listAdminComments } from "@/lib/admin/comments-query";
import { CommentRow } from "@/components/admin/comment-row";
import { PageHeader } from "@/components/admin/page-header";
import { NewContentButton } from "@/components/admin/new-content-button";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const admin = await requireAdminPage();
  const user = await prisma.user.findUnique({ where: { id: admin.id }, select: { lastSeenCommentsAt: true } });
  const since = user?.lastSeenCommentsAt ?? new Date(0);
  const [articles, posts, articleDrafts, postDrafts, comments, newComments, pending, recent] = await Promise.all([
    prisma.article.count({ where: { status: { not: "draft" } } }),
    prisma.blogPost.count({ where: { status: { not: "draft" } } }),
    prisma.article.count({ where: { status: "draft" } }),
    prisma.blogPost.count({ where: { status: "draft" } }),
    prisma.comment.count({ where: { status: { in: ["visible", "pending"] } } }),
    prisma.comment.count({ where: { createdAt: { gt: since }, isAdminReply: false } }),
    prisma.comment.count({ where: { status: "pending" } }),
    listAdminComments({ isAdminReply: false, status: { not: "deleted" } }, 6),
  ]);

  const stats = [
    { label: "Articles", value: articles, href: "/admin/articles" },
    { label: "Blog posts", value: posts, href: "/admin/blog" },
    { label: "Drafts", value: articleDrafts + postDrafts, href: "/admin/articles?status=draft" },
    { label: "Comments", value: comments, href: "/admin/comments", note: newComments ? `${newComments} new` : pending ? `${pending} pending` : undefined },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader title="Dashboard">
        <NewContentButton type="blog" label="New blog post" ghost />
        <NewContentButton type="article" label="New article" />
      </PageHeader>

      <dl className="grid grid-cols-2 border-t border-l border-line md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="border-r border-b border-line p-4 hover:bg-surface sm:p-5">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</dd>
            {s.note && <dd className="mt-1 text-xs font-medium">{s.note}</dd>}
          </Link>
        ))}
      </dl>

      <section className="mt-12">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="font-semibold">Recent comments</h2>
          <Link href="/admin/comments" className="text-sm underline">
            All comments
          </Link>
        </div>
        {recent.length ? (
          <div className="divide-y divide-line">
            {recent.map((c) => (
              <CommentRow key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-muted">No comments yet.</p>
        )}
      </section>
    </div>
  );
}
