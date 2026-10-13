"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

export type TaxItem = { id: string; name: string; slug: string; description?: string; count: number };

function Row({ kind, item }: { kind: "category" | "tag"; item: TaxItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [slug, setSlug] = useState(item.slug);
  const [description, setDescription] = useState(item.description ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await api(`/api/admin/taxonomy/${item.id}`, { method: "PUT", json: { kind, name, slug, description } });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    const what = kind === "category" ? `Delete category “${item.name}”? ${item.count} article(s) will become uncategorised.` : `Delete tag “${item.name}”? It will be removed from ${item.count} item(s).`;
    if (!confirm(what)) return;
    try {
      await api(`/api/admin/taxonomy/${item.id}?kind=${kind}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (editing) {
    return (
      <li className="space-y-2 py-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
          <input className="field" value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Slug" />
        </div>
        {kind === "category" && (
          <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" aria-label="Description" />
        )}
        {error && <p role="alert" className="text-sm font-medium">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={save}>Save</button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <span className="font-medium">{item.name}</span> <span className="text-sm text-muted">/{item.slug} · {item.count}</span>
        {error && <p role="alert" className="text-sm font-medium">{error}</p>}
      </div>
      <div className="flex">
        <button type="button" className="tap px-2 text-sm underline" onClick={() => setEditing(true)}>Edit</button>
        <button type="button" className="tap px-2 text-sm text-muted hover:text-fg" onClick={remove}>Delete</button>
      </div>
    </li>
  );
}

export function TaxonomyManager({ kind, items }: { kind: "category" | "tag"; items: TaxItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <section>
      <h2 className="mb-3 font-semibold">{kind === "category" ? "Categories" : "Tags"}</h2>
      <form
        className="mb-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await api("/api/admin/taxonomy", { json: { kind, name } });
            setName("");
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <label htmlFor={`new-${kind}`} className="sr-only">New {kind}</label>
        <input id={`new-${kind}`} className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${kind}`} maxLength={60} />
        <button type="submit" className="btn" disabled={!name.trim()}>Add</button>
      </form>
      {error && <p role="alert" className="mb-2 text-sm font-medium">{error}</p>}
      {items.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((i) => (
            <Row key={i.id} kind={kind} item={i} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">None yet.</p>
      )}
    </section>
  );
}
