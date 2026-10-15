"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { pickFiles, uploadImages, type MediaItem } from "./editor/upload";
import { CloseIcon } from "@/components/ui/icons";

type Props = { open: boolean; onClose: () => void; onSelect: (item: MediaItem) => void; title?: string };

/** Modal listing the media library with search and upload. Full-screen sheet on phones. */
export function MediaPicker({ open, onClose, onSelect, title = "Choose an image" }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async (p: number, query: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ items: MediaItem[]; total: number }>(`/api/admin/media?page=${p}&perPage=30&q=${encodeURIComponent(query)}`);
      setItems((prev) => (p === 1 ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setPage(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      void load(1, "");
    } else if (!open && d.open) d.close();
  }, [open, load]);

  async function upload() {
    const files = await pickFiles();
    if (!files.length) return;
    setLoading(true);
    try {
      const { items: uploaded, errors } = await uploadImages(files);
      if (errors.length) setError(errors.map((e) => `${e.filename}: ${e.error}`).join("; "));
      if (uploaded.length === 1) onSelect(uploaded[0]!);
      else await load(1, q);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-fg backdrop:bg-black/50 sm:m-auto sm:h-[80vh] sm:max-w-3xl sm:rounded-[var(--radius-xl)] sm:border sm:border-line sm:shadow-[var(--shadow-float)]"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="tap justify-center" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="flex gap-2 border-b border-line p-3">
          <input
            type="search"
            className="field"
            placeholder="Search by name or alt text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1, q)}
            aria-label="Search media"
          />
          <button type="button" className="btn" onClick={upload} disabled={loading}>
            Upload
          </button>
        </div>
        {error && <p className="px-4 pt-2 text-sm font-medium">{error}</p>}
        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 && !loading ? (
            <p className="p-6 text-center text-muted">No images yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {items.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => onSelect(m)} className="group block w-full text-left">
                    <span className="block aspect-square overflow-hidden rounded-[var(--radius-md)] bg-surface ring-offset-2 ring-offset-bg transition-shadow group-hover:ring-2 group-hover:ring-fg">
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails */}
                      <img src={`${m.url}?w=320`} alt={m.alt} className="size-full object-cover" loading="lazy" />
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted">{m.filename}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {items.length < total && (
            <div className="mt-4 text-center">
              <button type="button" className="btn btn-ghost" onClick={() => load(page + 1, q)} disabled={loading}>
                Load more
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
