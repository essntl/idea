"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { CommentRow, type AdminComment } from "./comment-row";

export function CommentsModeration({ comments }: { comments: AdminComment[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function bulk(action: "approve" | "show" | "hide" | "delete") {
    if (action === "delete" && !confirm(`Delete ${selected.size} comment(s)?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/comments", { json: { ids: [...selected], action } });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!comments.length) return <p className="border-y border-line py-10 text-center text-muted">No comments.</p>;
  return (
    <div>
      <div className="sticky top-14 z-10 flex min-h-11 flex-wrap items-center gap-2 border-b border-line bg-bg py-2 text-sm lg:top-0">
        <label className="tap gap-2">
          <input
            type="checkbox"
            className="size-4 accent-current"
            checked={selected.size === comments.length}
            onChange={(e) => setSelected(e.target.checked ? new Set(comments.map((c) => c.id)) : new Set())}
          />
          Select all
        </label>
        {selected.size > 0 && (
          <>
            <span className="text-muted">{selected.size} selected</span>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => bulk("approve")}>Approve</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => bulk("hide")}>Hide</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => bulk("show")}>Show</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => bulk("delete")}>Delete</button>
          </>
        )}
        {error && <span role="alert" className="font-medium">{error}</span>}
      </div>
      <div className="divide-y divide-line">
        {comments.map((c) => (
          <CommentRow
            key={c.id}
            c={c}
            selectable
            selected={selected.has(c.id)}
            onSelect={(on) =>
              setSelected((s) => {
                const n = new Set(s);
                if (on) n.add(c.id);
                else n.delete(c.id);
                return n;
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
