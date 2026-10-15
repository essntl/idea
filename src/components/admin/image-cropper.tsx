"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "./editor/upload";
import { api } from "./api";

type Crop = { x: number; y: number; width: number; height: number };

/**
 * Fixed-aspect (16:9 by default) crop: drag the frame to move it, use the slider to resize.
 * Saves a new cropped copy in the media library.
 */
export function ImageCropper({ image, aspect = 16 / 9, onDone, onCancel }: { image: MediaItem; aspect?: number; onDone: (m: MediaItem) => void; onCancel: () => void }) {
  const ratio = image.width / image.height;
  // Height fraction for a given width fraction so that the crop has the requested aspect.
  const hFor = (w: number) => (w * ratio) / aspect;
  const maxW = Math.min(1, aspect / ratio);
  const [crop, setCrop] = useState<Crop>(() => {
    const w = maxW;
    const h = hFor(w);
    return { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const clamp = (c: Crop): Crop => ({ ...c, x: Math.min(Math.max(0, c.x), 1 - c.width), y: Math.min(Math.max(0, c.y), 1 - c.height) });

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const d = drag.current;
    setCrop((c) => clamp({ ...c, x: d.x + (e.clientX - d.px) / r.width, y: d.y + (e.clientY - d.py) / r.height }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { item } = await api<{ item: MediaItem }>(`/api/admin/media/${image.id}/crop`, { json: crop });
      onDone(item);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} onCancel={onCancel} className="m-auto w-[min(48rem,calc(100vw-2rem))] max-w-none floating rounded-[var(--radius-xl)] p-5 text-fg backdrop:bg-black/60">
      <h2 className="mb-3 font-semibold">Crop preview image (16:9)</h2>
      <div ref={box} className="relative w-full touch-none select-none" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- crop source */}
        <img src={`${image.url}?w=1200`} alt="" className="absolute inset-0 size-full" draggable={false} />
        <div
          className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          role="presentation"
        />
      </div>
      <label className="mt-4 flex items-center gap-3 text-sm">
        Size
        <input
          type="range"
          min={0.2}
          max={maxW}
          step={0.01}
          value={crop.width}
          className="flex-1 accent-current"
          onChange={(e) => {
            const w = Number(e.target.value);
            setCrop((c) => {
              const cx = c.x + c.width / 2;
              const cy = c.y + c.height / 2;
              const h = hFor(w);
              return clamp({ x: cx - w / 2, y: cy - h / 2, width: w, height: h });
            });
          }}
        />
      </label>
      {error && <p className="mt-2 text-sm font-medium">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save crop"}
        </button>
      </div>
    </dialog>
  );
}
