"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { LocalTime } from "./local-time";
import { ActionBar } from "./action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu } from "@/components/ui/menu";
import { ChevronRight } from "@/components/ui/icons";

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
  /** Live post with autosaved, unpublished changes. */
  pending?: boolean;
  /** Projects: where the project stands ("Building", "Live", …). */
  phase?: string;
};

const EDIT_BASE = { blog: "/admin/blog", article: "/admin/articles", project: "/admin/projects" } as const;

const STATUS: Record<ContentRow["status"], string> = { draft: "Draft", published: "Published", scheduled: "Scheduled" };

/** Card list of posts. Tap a row to edit; checkboxes select for bulk actions in a floating bar. */
export function ContentTable({ type, rows }: { type: keyof typeof EDIT_BASE; rows: ContentRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editBase = EDIT_BASE[type];
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

  if (!rows.length) return <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong py-10 text-center text-muted">Nothing here yet.</p>;

  return (
    <div className="pb-20">
      <div className="mb-1 flex items-center justify-between pl-[13px]">
        <Checkbox
          checked={allSelected}
          indeterminate={selected.size > 0 && !allSelected}
          onChange={(on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set())}
          label={<span className="text-muted">{selected.size ? `${selected.size} selected` : "Select all"}</span>}
        />
        <span className="pr-1 text-xs text-subtle">{rows.length} shown</span>
      </div>

      <ul className="card divide-y divide-line overflow-hidden">
        {rows.map((r) => {
          const meta = [
            type === "project" ? r.phase : null,
            type === "article" ? r.category : r.tags.slice(0, 3).join(", "),
            typeof r.comments === "number" && r.comments > 0 ? `${r.comments} comment${r.comments === 1 ? "" : "s"}` : null,
          ].filter(Boolean);
          return (
            <li key={r.id} className={`relative flex items-center gap-0.5 pr-2 pl-1 transition-colors hover:bg-surface ${selected.has(r.id) ? "bg-surface" : ""}`}>
              <Checkbox checked={selected.has(r.id)} onChange={(on) => toggle(r.id, on)} aria-label={`Select ${r.title || "untitled"}`} className="relative z-10 shrink-0 justify-center" />
              <Link href={`${editBase}/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 after:absolute after:inset-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.title || <span className="text-muted italic">Untitled</span>}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                    <span className={`rounded-full px-2 py-px text-xs ${r.status === "draft" ? "bg-surface-2" : "bg-fg text-bg"}`}>{STATUS[r.status]}</span>
                    {r.pending && (
                      <span className="rounded-full border border-line-strong px-2 py-px text-xs" title="Autosaved changes not yet published">
                        Unpublished edits
                      </span>
                    )}
                    <span>{r.date ? <LocalTime iso={r.date} dateOnly /> : <>Edited <LocalTime iso={r.updatedAt} dateOnly /></>}</span>
                    {meta.map((m) => (
                      <span key={m} className="hidden truncate sm:inline">
                        · {m}
                      </span>
                    ))}
                  </span>
                </span>
                <ChevronRight width={16} height={16} className="shrink-0 text-subtle" />
              </Link>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 && (
        <ActionBar label={error ?? `${selected.size} selected`}>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => bulk("publish")}>
            Publish
          </button>
          <Menu
            label="More bulk actions"
            className="border border-line-strong"
            items={[
              { label: "Unpublish", onSelect: () => void bulk("unpublish"), disabled: busy },
              "separator",
              { label: "Delete", destructive: true, onSelect: () => void bulk("delete"), disabled: busy },
            ]}
          />
        </ActionBar>
      )}
    </div>
  );
}
