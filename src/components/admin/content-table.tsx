"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { LocalTime } from "./local-time";

export type ContentRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "scheduled";
  date: string | null;
  updatedAt: string;
  tags: string[];
  category?: string | null;
  comments?: number;
  url: string | null;
};

/** Responsive list: a table on wide screens, stacked rows on phones. Selection enables bulk actions. */
export function ContentTable({ type, rows }: { type: "blog" | "article"; rows: ContentRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editBase = type === "blog" ? "/admin/blog" : "/admin/articles";
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string, on: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  async function bulk(action: "delete" | "publish" | "unpublish") {
    if (action === "delete" && !confirm(`Delete ${selected.size} item(s) permanently?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/bulk", { json: { type, action, ids: [...selected] } });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!rows.length) return <p className="border-y border-line py-10 text-center text-muted">Nothing here yet.</p>;

  return (
    <div>
      <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2 text-sm">
        <label className="tap gap-2">
          <input type="checkbox" className="size-4 accent-current" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
          Select all
        </label>
        {selected.size > 0 && (
          <>
            <span className="text-muted">{selected.size} selected</span>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => bulk("publish")}>Publish</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => bulk("unpublish")}>Unpublish</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => bulk("delete")}>Delete</button>
          </>
        )}
        {error && <span role="alert" className="font-medium">{error}</span>}
      </div>

      <div className="hidden grid-cols-[2rem_minmax(0,1fr)_7rem_8rem_8rem] gap-4 border-b border-line pb-2 text-xs font-medium tracking-wide text-muted uppercase md:grid">
        <span />
        <span>Title</span>
        <span>Status</span>
        <span>{type === "article" ? "Category" : "Tags"}</span>
        <span>Date</span>
      </div>
      <ul className="divide-y divide-line border-b border-line">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-3 md:grid-cols-[2rem_minmax(0,1fr)_7rem_8rem_8rem] md:items-center">
            <input type="checkbox" className="mt-1 size-4 accent-current md:mt-0" checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} aria-label={`Select ${r.title || "untitled"}`} />
            <div className="min-w-0">
              <Link href={`${editBase}/${r.id}`} className="block truncate font-medium hover:underline">
                {r.title || <span className="text-muted italic">Untitled</span>}
              </Link>
              <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                {r.url && r.status !== "draft" && (
                  <a href={r.url} target="_blank" className="hover:underline" rel="noreferrer">{r.url}</a>
                )}
                {typeof r.comments === "number" && r.comments > 0 && <span>{r.comments} comments</span>}
              </div>
            </div>
            <div className="col-start-2 flex flex-wrap gap-x-3 text-sm text-muted md:contents">
              <span className={r.status === "draft" ? "" : "text-fg"}>
                {r.status === "draft" ? "Draft" : r.status === "scheduled" ? "Scheduled" : "Published"}
              </span>
              <span className="truncate">{type === "article" ? (r.category ?? "—") : r.tags.join(", ") || "—"}</span>
              <span>{r.date ? <LocalTime iso={r.date} dateOnly /> : <>edited <LocalTime iso={r.updatedAt} dateOnly /></>}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
