"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { Sheet } from "@/components/ui/sheet";
import { ChevronRight, PlusIcon } from "@/components/ui/icons";
import { slugify } from "@/lib/slug";

export type TaxItem = { id: string; name: string; slug: string; description?: string; count: number };

type Editing = { mode: "create" } | { mode: "edit"; item: TaxItem };

function TaxonomySheet({ kind, editing, onClose }: { kind: "category" | "tag"; editing: Editing | null; onClose: () => void }) {
  const router = useRouter();
  const item = editing?.mode === "edit" ? editing.item : null;
  const [name, setName] = useState(item?.name ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!item);
  const [description, setDescription] = useState(item?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const noun = kind === "category" ? "category" : "tag";
  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (item) await api(`/api/admin/taxonomy/${item.id}`, { method: "PUT", json: { kind, name, slug: effectiveSlug, description } });
      else await api("/api/admin/taxonomy", { json: { kind, name, slug: effectiveSlug || undefined, description } });
      onClose();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item) return;
    setBusy(true);
    try {
      await api(`/api/admin/taxonomy/${item.id}?kind=${kind}`, { method: "DELETE" });
      onClose();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const usage = item
    ? kind === "category"
      ? `${item.count} article${item.count === 1 ? "" : "s"} will become uncategorised.`
      : `It will be removed from ${item.count} post${item.count === 1 ? "" : "s"}.`
    : "";

  return (
    <Sheet
      open={!!editing}
      onClose={onClose}
      title={item ? `Edit ${noun}` : `New ${noun}`}
      footer={
        confirmDelete ? (
          <>
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Keep
            </button>
            <button type="button" className="btn flex-1" onClick={remove} disabled={busy}>
              Delete {noun}
            </button>
          </>
        ) : (
          <>
            {item && (
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>
                Delete
              </button>
            )}
            <span className="flex-1" />
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={save} disabled={busy || !name.trim()}>
              {item ? "Save" : "Create"}
            </button>
          </>
        )
      }
    >
      {confirmDelete ? (
        <p className="py-2 text-[0.9375rem]">
          Delete <strong>{item?.name}</strong>? {usage}
        </p>
      ) : (
        <form
          className="space-y-4 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div>
            <label htmlFor="tax-name" className="mb-1 block text-sm font-medium">
              Name
            </label>
            <input id="tax-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus required />
          </div>
          <div>
            <label htmlFor="tax-slug" className="mb-1 block text-sm font-medium">
              URL slug
            </label>
            <div className="flex items-center rounded-[var(--radius-md)] border border-line-strong focus-within:border-fg">
              <span className="pl-3 text-sm text-subtle">/{kind === "category" ? "articles/category" : "…/tag"}/</span>
              <input
                id="tax-slug"
                className="min-h-11 min-w-0 flex-1 bg-transparent px-1 pr-3 outline-none"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
                maxLength={80}
              />
            </div>
            <p className="mt-1 text-xs text-muted">{item ? "Changing it changes the page address." : "Follows the name until you edit it."}</p>
          </div>
          {kind === "category" && (
            <div>
              <label htmlFor="tax-desc" className="mb-1 block text-sm font-medium">
                Description <span className="font-normal text-subtle">· optional</span>
              </label>
              <textarea id="tax-desc" className="field min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
              <p className="mt-1 text-xs text-muted">Shown at the top of the category page.</p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium">
              {error}
            </p>
          )}
          <button type="submit" hidden />
        </form>
      )}
    </Sheet>
  );
}

export function TaxonomyManager({ kind, items }: { kind: "category" | "tag"; items: TaxItem[] }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const title = kind === "category" ? "Categories" : "Tags";
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">
          {title} <span className="font-normal text-muted">· {items.length}</span>
        </h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ mode: "create" })}>
          <PlusIcon width={16} height={16} /> Add
        </button>
      </div>
      {items.length ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => setEditing({ mode: "edit", item: i })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.name}</span>
                  <span className="block truncate text-sm text-subtle">/{i.slug}</span>
                </span>
                <span className="rounded-full bg-surface-2 px-2 py-px text-xs text-muted" title={`Used ${i.count} times`}>
                  {i.count}
                </span>
                <ChevronRight width={16} height={16} className="shrink-0 text-subtle" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong py-8 text-center text-sm text-muted">None yet.</p>
      )}
      {/* Remount per item so the form starts from that item's values. */}
      <TaxonomySheet key={editing ? (editing.mode === "edit" ? editing.item.id : "new") : "closed"} kind={kind} editing={editing} onClose={() => setEditing(null)} />
    </section>
  );
}
