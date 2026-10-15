"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "./api";
import { LocalTime } from "./local-time";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu } from "@/components/ui/menu";
import { ReplyIcon, CheckIcon } from "@/components/ui/icons";
import { Avatar, CommentBody } from "@/components/site/comments/comment-body";
import CommentEditor, { type CommentEditorHandle } from "@/components/site/comments/comment-editor";

export type AdminComment = {
  id: string;
  body: string;
  bodyHtml: string | null;
  authorName: string;
  authorEmail: string | null;
  isAdminReply: boolean;
  status: "visible" | "pending" | "hidden" | "deleted";
  createdAt: string;
  target: { kind: "article" | "blog"; title: string; url: string; editUrl: string };
  parent: { authorName: string; body: string; status: string } | null;
};

const STATUS_LABEL: Record<AdminComment["status"], string> = { visible: "Visible", pending: "Pending", hidden: "Hidden", deleted: "Deleted" };

/** One comment as a card: who, where, what, and actions (Reply, Approve, ⋯). */
export function CommentRow({ c, selectable, selected, onSelect }: { c: AdminComment; selectable?: boolean; selected?: boolean; onSelect?: (v: boolean) => void }) {
  const router = useRouter();
  const editor = useRef<CommentEditorHandle>(null);
  const [replying, setReplying] = useState(false);
  const [hasReply, setHasReply] = useState(false);
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
    <article className={`card p-4 transition-colors sm:p-5 ${selected ? "border-fg" : ""} ${c.status === "deleted" ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        {selectable && (
          <Checkbox checked={!!selected} onChange={(v) => onSelect?.(v)} aria-label={`Select comment by ${c.authorName}`} className="-mt-1.5 -ml-2 min-w-9 justify-center" />
        )}
        <Avatar name={c.authorName} author={c.isAdminReply} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{c.authorName}</span>
            {c.isAdminReply && <span className="shrink-0 rounded-full bg-fg px-2 py-px text-[0.7rem] font-semibold text-bg">Author</span>}
            {c.status !== "visible" && <span className="shrink-0 rounded-full border border-line-strong px-2 py-px text-xs">{STATUS_LABEL[c.status]}</span>}
            <span className="ml-auto shrink-0 text-xs text-subtle">
              <LocalTime iso={c.createdAt} dateOnly />
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">
            on{" "}
            <Link href={c.target.editUrl} className="text-fg hover:underline">
              {c.target.title || "Untitled"}
            </Link>
            <span className="text-subtle"> · {c.target.kind === "article" ? "Article" : "Blog post"}</span>
          </p>
          {c.authorEmail && !c.isAdminReply && <p className="truncate text-xs text-subtle">{c.authorEmail}</p>}
        </div>
      </div>

      {c.parent && (
        <p className="mt-3 truncate rounded-[var(--radius-md)] bg-surface px-3 py-2 text-sm text-muted">
          <span className="font-medium">↳ {c.parent.authorName}:</span> {c.parent.status === "visible" ? c.parent.body : "(removed)"}
        </p>
      )}

      <div className="mt-3">
        <CommentBody html={c.bodyHtml} text={c.body} maxHeight={220} />
      </div>

      <div className="mt-3 flex items-center gap-1 border-t border-line pt-2">
        <button type="button" className="btn-quiet -ml-2" onClick={() => setReplying((v) => !v)} disabled={busy} aria-expanded={replying}>
          <ReplyIcon width={16} height={16} /> Reply
        </button>
        {c.status === "pending" && (
          <button type="button" className="btn-quiet text-fg" onClick={() => setStatus("visible")} disabled={busy}>
            <CheckIcon width={16} height={16} /> Approve
          </button>
        )}
        <span className="flex-1" />
        <Menu
          label="Comment actions"
          className="-mr-2"
          items={[
            { label: "View on site", href: `${c.target.url}#comment-${c.id}`, newTab: true },
            "separator",
            ...(c.status === "visible" ? [{ label: "Hide", onSelect: () => setStatus("hidden") }] : []),
            ...(c.status === "hidden" || c.status === "deleted" ? [{ label: c.status === "deleted" ? "Restore" : "Show", onSelect: () => setStatus("visible") }] : []),
            ...(c.status !== "deleted"
              ? [
                  {
                    label: "Delete",
                    destructive: true,
                    onSelect: () => {
                      if (confirm("Delete this comment? Replies stay and show “comment removed”.")) void setStatus("deleted");
                    },
                  },
                ]
              : []),
          ]}
        />
      </div>

      {replying && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(`/api/admin/comments/${c.id}`, { method: "POST", json: { bodyJson: editor.current?.getJSON() } });
              editor.current?.clear();
              setReplying(false);
            });
          }}
        >
          <CommentEditor handleRef={editor} placeholder={`Reply to ${c.authorName}…`} autoFocus onChange={(t) => setHasReply(t.trim().length > 0)} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplying(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-sm" disabled={busy || !hasReply}>
              Post reply
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium">
          {error}
        </p>
      )}
    </article>
  );
}
