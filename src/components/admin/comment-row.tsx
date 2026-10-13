"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { LocalTime } from "./local-time";

export type AdminComment = {
  id: string;
  body: string;
  authorName: string;
  authorEmail: string | null;
  isAdminReply: boolean;
  status: "visible" | "pending" | "hidden" | "deleted";
  createdAt: string;
  article: { id: string; title: string; slug: string };
  parent: { authorName: string; body: string; status: string } | null;
};

const STATUS_LABEL: Record<AdminComment["status"], string> = { visible: "Visible", pending: "Pending", hidden: "Hidden", deleted: "Deleted" };

export function CommentRow({ c, selectable, selected, onSelect }: { c: AdminComment; selectable?: boolean; selected?: boolean; onSelect?: (v: boolean) => void }) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (status: AdminComment["status"]) => run(() => api(`/api/admin/comments/${c.id}`, { method: "PATCH", json: { status } }));

  return (
    <article className={`py-5 ${c.status !== "visible" ? "opacity-90" : ""}`}>
      <div className="flex gap-3">
        {selectable && (
          <input type="checkbox" className="mt-1.5 size-4 shrink-0 accent-current" checked={selected} onChange={(e) => onSelect?.(e.target.checked)} aria-label={`Select comment by ${c.authorName}`} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium">{c.authorName}</span>
            {c.isAdminReply && <span className="rounded-sm border border-fg px-1 text-[0.65rem] font-semibold uppercase">Author</span>}
            {c.authorEmail && !c.isAdminReply && <span className="text-muted">{c.authorEmail}</span>}
            <span className={`rounded-sm px-1.5 text-xs ${c.status === "visible" ? "border border-line text-muted" : "bg-fg text-bg"}`}>{STATUS_LABEL[c.status]}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            on{" "}
            <Link href={`/admin/articles/${c.article.id}`} className="underline">
              {c.article.title || "Untitled"}
            </Link>{" "}
            · <LocalTime iso={c.createdAt} />
          </p>
          {c.parent && (
            <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm text-muted">
              <span className="font-medium">↳ in reply to {c.parent.authorName}:</span> {c.parent.status === "visible" ? c.parent.body.slice(0, 200) : "(removed)"}
            </blockquote>
          )}
          <p className="mt-2 whitespace-pre-line break-words">{c.body}</p>

          <div className="mt-2 flex flex-wrap gap-x-1 text-sm">
            <a href={`/articles/${c.article.slug}#comment-${c.id}`} target="_blank" className="tap px-2 text-muted hover:text-fg" rel="noreferrer">
              View in context
            </a>
            <button type="button" className="tap px-2 text-muted hover:text-fg" onClick={() => setReplying((v) => !v)} disabled={busy}>
              Reply
            </button>
            {c.status === "pending" && (
              <button type="button" className="tap px-2 font-medium hover:underline" onClick={() => setStatus("visible")} disabled={busy}>
                Approve
              </button>
            )}
            {c.status === "visible" && (
              <button type="button" className="tap px-2 text-muted hover:text-fg" onClick={() => setStatus("hidden")} disabled={busy}>
                Hide
              </button>
            )}
            {(c.status === "hidden" || c.status === "deleted") && (
              <button type="button" className="tap px-2 text-muted hover:text-fg" onClick={() => setStatus("visible")} disabled={busy}>
                {c.status === "deleted" ? "Restore" : "Show"}
              </button>
            )}
            {c.status !== "deleted" && (
              <button
                type="button"
                className="tap px-2 text-muted hover:text-fg"
                disabled={busy}
                onClick={() => confirm("Delete this comment? Replies will remain and show “comment removed”.") && setStatus("deleted")}
              >
                Delete
              </button>
            )}
          </div>

          {replying && (
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api(`/api/admin/comments/${c.id}`, { method: "POST", json: { body: reply } });
                  setReply("");
                  setReplying(false);
                });
              }}
            >
              <label htmlFor={`reply-${c.id}`} className="sr-only">
                Reply as author
              </label>
              <textarea id={`reply-${c.id}`} className="field min-h-24" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as author…" autoFocus />
              <div className="flex gap-2">
                <button type="submit" className="btn" disabled={busy || !reply.trim()}>
                  Post reply
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setReplying(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm font-medium">
              {error}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
