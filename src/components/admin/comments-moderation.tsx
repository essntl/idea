"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { CommentRow, type AdminComment } from "./comment-row";
import { ActionBar } from "./action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu } from "@/components/ui/menu";

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

  if (!comments.length) return <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong py-10 text-center text-muted">No comments here.</p>;
  const all = selected.size === comments.length;
  return (
    <div className="pb-20">
      <div className="mb-1 pl-1">
        <Checkbox
          checked={all}
          indeterminate={selected.size > 0 && !all}
          onChange={(on) => setSelected(on ? new Set(comments.map((c) => c.id)) : new Set())}
          label={<span className="text-muted">{selected.size ? `${selected.size} selected` : "Select all"}</span>}
        />
      </div>
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id}>
            <CommentRow
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
          </li>
        ))}
      </ul>
      {selected.size > 0 && (
        <ActionBar label={error ?? `${selected.size} selected`}>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => bulk("approve")}>
            Approve
          </button>
          <Menu
            label="More bulk actions"
            className="border border-line-strong"
            items={[
              { label: "Hide", onSelect: () => bulk("hide") },
              { label: "Show", onSelect: () => bulk("show") },
              "separator",
              { label: "Delete", destructive: true, onSelect: () => bulk("delete") },
            ]}
          />
        </ActionBar>
      )}
    </div>
  );
}
