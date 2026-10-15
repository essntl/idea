"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { pickFiles, uploadImages, isImageFile, type MediaItem } from "./editor/upload";
import { CloseIcon } from "@/components/ui/icons";

type Usage = { kind: string; title: string; href: string }[];

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export function MediaLibrary({ items }: { items: MediaItem[] }) {
  const router = useRouter();
  const [active, setActive] = useState<MediaItem | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(files: File[]) {
    const images = files.filter(isImageFile);
    if (!images.length) return;
    setBusy(true);
    setMessage(`Uploading ${images.length}…`);
    try {
      const { items: done, errors } = await uploadImages(images);
      setMessage(`${done.length} uploaded${errors.length ? `; failed: ${errors.map((e) => `${e.filename} (${e.error})`).join(", ")}` : ""}`);
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function open(m: MediaItem) {
    setActive(m);
    setAlt(m.alt);
    setUsage(null);
    try {
      const r = await api<{ usage: Usage }>(`/api/admin/media/${m.id}`);
      setUsage(r.usage);
    } catch {
      setUsage([]);
    }
  }

  async function saveAlt() {
    if (!active) return;
    setBusy(true);
    try {
      await api(`/api/admin/media/${active.id}`, { method: "PATCH", json: { alt } });
      setMessage("Alt text saved");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!active) return;
    const inUse = usage && usage.length > 0;
    const q = inUse
      ? `This image is used in ${usage!.length} place(s). Deleting it will break those images. Delete anyway?`
      : "Delete this image permanently?";
    if (!confirm(q)) return;
    setBusy(true);
    try {
      await api(`/api/admin/media/${active.id}${inUse ? "?force=1" : ""}`, { method: "DELETE" });
      setActive(null);
      setMessage("Deleted");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(Array.from(e.dataTransfer.files));
      }}
      className={`rounded-[var(--radius-lg)] ${dragging ? "outline-2 outline-offset-4 outline-fg outline-dashed" : ""}`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn" disabled={busy} onClick={async () => upload(await pickFiles())}>
          Upload images
        </button>
        <span className="text-sm text-muted">or drop files here. JPEG, PNG, WebP, GIF, AVIF — stored as WebP.</span>
      </div>
      {message && <p role="status" className="mb-4 text-sm">{message}</p>}

      {items.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong py-10 text-center text-muted">No images yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => open(m)} className="group block w-full text-left">
                <span className={`block aspect-square overflow-hidden rounded-[var(--radius-md)] bg-surface ring-offset-2 ring-offset-bg transition-shadow ${active?.id === m.id ? "ring-2 ring-fg" : "group-hover:ring-1 group-hover:ring-line-strong"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails */}
                  <img src={`${m.url}?w=320`} alt={m.alt} loading="lazy" className="size-full object-cover" />
                </span>
                <span className="mt-1 block truncate text-xs text-muted">{m.filename}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Image details">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => setActive(null)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[90dvh] animate-sheet-in overflow-y-auto rounded-t-[var(--radius-xl)] bg-bg p-4 shadow-[var(--shadow-float)] sm:inset-y-2 sm:right-2 sm:left-auto sm:max-h-none sm:w-96 sm:rounded-[var(--radius-xl)] sm:border sm:border-line">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Image</h2>
              <button type="button" className="tap justify-center" onClick={() => setActive(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
            <img src={`${active.url}?w=768`} alt={active.alt} className="w-full rounded-[var(--radius-md)]" />
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">File</dt>
              <dd className="truncate">{active.filename}</dd>
              <dt className="text-muted">Size</dt>
              <dd>{active.width} × {active.height} · {kb(active.size)}</dd>
              <dt className="text-muted">Uploaded</dt>
              <dd>{new Date(active.createdAt).toLocaleString()}</dd>
            </dl>
            <label htmlFor="alt" className="mt-4 mb-1 block text-sm font-medium">Alt text</label>
            <textarea id="alt" className="field min-h-20" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={500} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={saveAlt} disabled={busy || alt === active.alt}>Save alt text</button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(new URL(active.url, window.location.origin).toString());
                  setMessage("URL copied");
                }}
              >
                Copy URL
              </button>
            </div>
            <div className="mt-6 border-t border-line pt-4 text-sm">
              <p className="font-medium">Used in</p>
              {usage === null ? (
                <p className="text-muted">Checking…</p>
              ) : usage.length === 0 ? (
                <p className="text-muted">Not used anywhere.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {usage.map((u) => (
                    <li key={u.kind + u.href}>
                      <a href={u.href} className="underline">{u.title}</a> <span className="text-muted">({u.kind})</span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn btn-ghost mt-4 w-full" onClick={remove} disabled={busy}>Delete image</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
