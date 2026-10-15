"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { CommentRow, type AdminComment } from "./comment-row";
import { ActionBar } from "./action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu, type MenuItem } from "@/components/ui/menu";

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

  // Offer only the actions that change something for the current selection.
  const picked = comments.filter((c) => selected.has(c.id));
  const count = (st: AdminComment["status"]) => picked.filter((c) => c.status === st).length;
  const pending = count("pending");
  const visible = count("visible");
  const removed = count("hidden") + count("deleted");
  type Action = "approve" | "show" | "hide" | "delete";
  const primary: { action: Action; label: string } = pending
    ? { action: "approve", label: pending === picked.length ? "Approve" : `Approve ${pending}` }
    : removed && !visible
      ? { action: "show", label: "Show" }
      : { action: "hide", label: "Hide" };
  const secondary: MenuItem[] = [
    ...(primary.action !== "show" && removed ? [{ label: "Show", onSelect: () => void bulk("show") }] : []),
    ...(primary.action !== "hide" && visible + pending ? [{ label: "Hide", onSelect: () => void bulk("hide") }] : []),
    ...(count("deleted") < picked.length ? (["separator", { label: "Delete", destructive: true, onSelect: () => void bulk("delete") }] as MenuItem[]) : []),
  ].filter((item, i) => !(item === "separator" && i === 0));
  const summary = [`${selected.size} selected`, pending ? `${pending} pending` : null].filter(Boolean).join(" · ");
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
        <ActionBar label={error ?? summary}>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => bulk(primary.action)}>
            {primary.label}
          </button>
          {secondary.length > 0 && <Menu label="More bulk actions" className="border border-line-strong" items={secondary} />}
        </ActionBar>
      )}
    </div>
  );
}
