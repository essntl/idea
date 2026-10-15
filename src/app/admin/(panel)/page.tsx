import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/guard";
import { listAdminComments } from "@/lib/admin/comments-query";
import { CommentRow } from "@/components/admin/comment-row";
import { PageHeader } from "@/components/admin/page-header";
import { NewContentMenu } from "@/components/admin/new-content-menu";
import { LocalTime } from "@/components/admin/local-time";
import { listInProgress } from "@/lib/admin/drafts-query";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const admin = await requireAdminPage();
  const user = await prisma.user.findUnique({ where: { id: admin.id }, select: { lastSeenCommentsAt: true } });
  const since = user?.lastSeenCommentsAt ?? new Date(0);
  const [articles, posts, articleDrafts, postDrafts, comments, newComments, pending, recent, inProgress] = await Promise.all([
    prisma.article.count({ where: { status: { not: "draft" } } }),
    prisma.blogPost.count({ where: { status: { not: "draft" } } }),
    prisma.article.count({ where: { status: "draft" } }),
    prisma.blogPost.count({ where: { status: "draft" } }),
    prisma.comment.count({ where: { status: { in: ["visible", "pending"] } } }),
    prisma.comment.count({ where: { createdAt: { gt: since }, isAdminReply: false } }),
    prisma.comment.count({ where: { status: "pending" } }),
    listAdminComments({ isAdminReply: false, status: { not: "deleted" } }, 6),
    listInProgress(8),
  ]);

  const stats = [
    { label: "Articles", value: articles, href: "/admin/articles" },
    { label: "Blog posts", value: posts, href: "/admin/blog" },
    { label: "Drafts", value: articleDrafts + postDrafts, href: "#continue-writing" },
    { label: "Comments", value: comments, href: "/admin/comments", note: newComments ? `${newComments} new` : pending ? `${pending} pending` : undefined },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader title="Dashboard">
        <NewContentMenu />
      </PageHeader>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 transition-colors hover:bg-surface sm:p-5">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</dd>
            {s.note && <dd className="mt-1 text-xs font-medium">{s.note}</dd>}
          </Link>
        ))}
      </dl>

      <section className="mt-12" id="continue-writing" aria-labelledby="continue-title">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 id="continue-title" className="font-semibold">Continue writing</h2>
          <span className="text-sm text-muted">Drafts and unpublished changes</span>
        </div>
        {inProgress.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {inProgress.map((i) => (
              <li key={i.key}>
                <Link href={i.href} className="card flex h-full flex-col gap-1 p-4 transition-colors hover:bg-surface">
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{i.type}</span>
                    <span className={`rounded-full px-2 py-px ${i.state === "draft" ? "bg-surface-2" : "bg-fg text-bg"}`}>
                      {i.state === "draft" ? "Draft" : "Unpublished changes"}
                    </span>
                  </span>
                  <span className="font-medium">{i.title || <span className="text-muted italic">Untitled</span>}</span>
                  <span className="text-xs text-muted">
                    Last edited <LocalTime iso={i.at} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-muted">Nothing in progress. Everything is published.</p>
        )}
      </section>

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
