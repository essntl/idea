"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, CloseIcon } from "@/components/ui/icons";

type Item = { src: string; alt: string; caption: string };

const SELECTOR = ".prose figure img, [data-zoomable] img";

/** Largest stored variant of a media image (content images use ?w= variants). */
function fullSrc(img: HTMLImageElement): string {
  const src = img.currentSrc || img.src;
  try {
    const u = new URL(src, window.location.href);
    if (u.pathname.startsWith("/media/")) return `${u.pathname}?w=2000`;
  } catch {
    // keep src
  }
  return src;
}

function collect(img: HTMLImageElement): { items: Item[]; index: number } {
  const scope = img.closest(".prose, [data-zoomable]")?.closest("article") ?? document;
  const imgs = Array.from(scope.querySelectorAll<HTMLImageElement>(SELECTOR)).filter((i) => !i.closest('[data-missing="true"]'));
  return {
    items: imgs.map((i) => ({ src: fullSrc(i), alt: i.alt, caption: i.closest("figure")?.querySelector("figcaption")?.textContent?.trim() ?? "" })),
    index: Math.max(0, imgs.indexOf(img)),
  };
}

/**
 * Click any image in post content to view it larger. Click the image to toggle actual size,
 * ←/→ to move between images, Esc or click outside to close.
 */
export function ImageLightbox() {
  const [state, setState] = useState<{ items: Item[]; index: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setState(null);
    opener.current?.focus({ preventScroll: true });
  }, []);
  const go = useCallback((d: number) => {
    setZoomed(false);
    setLoaded(false);
    setState((s) => (s ? { ...s, index: (s.index + d + s.items.length) % s.items.length } : s));
  }, []);

  // Delegated click handler: works for every page without wiring each image.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const img = (e.target as HTMLElement).closest?.("img");
      if (!img || !img.matches(SELECTOR) || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      if (img.closest("a")) return; // linked images keep their link
      e.preventDefault();
      opener.current = img;
      setZoomed(false);
      setLoaded(false);
      setState(collect(img as HTMLImageElement));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Make content images keyboard-reachable and announce them as zoomable.
  useEffect(() => {
    const mark = () =>
      document.querySelectorAll<HTMLImageElement>(SELECTOR).forEach((img) => {
        if (img.dataset.lightbox || img.closest("a")) return;
        img.dataset.lightbox = "1";
        img.tabIndex = 0;
        img.setAttribute("role", "button");
        img.setAttribute("aria-label", `${img.alt || "Image"} — open larger view`);
        img.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            img.click();
          }
        });
      });
    mark();
    const obs = new MutationObserver(mark);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!state) return;
    closeBtn.current?.focus({ preventScroll: true });
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && state.items.length > 1) go(1);
      else if (e.key === "ArrowLeft" && state.items.length > 1) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [state, close, go]);

  if (!state) return null;
  const item = state.items[state.index]!;
  const many = state.items.length > 1;
  const navBtn = "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={item.alt || "Image"} className="fixed inset-0 z-[80] animate-fade-in bg-black/90 text-white">
      <div
        className={`absolute inset-0 overflow-auto ${zoomed ? "cursor-zoom-out" : "flex items-center justify-center p-4 sm:p-12"}`}
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- full-size view of an already optimised media image */}
        <img
          key={item.src}
          src={item.src}
          alt={item.alt}
          onLoad={() => setLoaded(true)}
          onClick={() => setZoomed((z) => !z)}
          className={`select-none transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"} ${
            zoomed ? "m-auto max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in rounded-[var(--radius-md)] object-contain"
          }`}
          draggable={false}
        />
      </div>

      <button ref={closeBtn} type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur hover:bg-black/70">
        <CloseIcon />
      </button>
      {many && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={`${navBtn} left-3`}>
            <ArrowLeft />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next image" className={`${navBtn} right-3`}>
            <ArrowRight />
          </button>
        </>
      )}
      {(item.caption || many) && !zoomed && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 mx-auto flex w-fit max-w-prose flex-col items-center gap-1 rounded-[var(--radius-lg)] bg-black/60 px-4 py-2 text-center text-sm backdrop-blur">
          {item.caption && <p>{item.caption}</p>}
          {many && (
            <p className="text-xs text-white/60">
              {state.index + 1} / {state.items.length}
            </p>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
