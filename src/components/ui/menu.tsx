"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreIcon } from "./icons";
import { anchorTo, type AnchoredPosition } from "./floating";

export type MenuItem =
  | { label: string; onSelect: () => void; icon?: React.ReactNode; destructive?: boolean; disabled?: boolean; href?: undefined }
  | { label: string; href: string; icon?: React.ReactNode; newTab?: boolean; onSelect?: undefined; destructive?: false; disabled?: boolean }
  | "separator";

/** "⋯" overflow menu: floating list of actions rendered in a portal. */
export function Menu({
  items,
  label = "More actions",
  className = "",
  trigger,
}: {
  items: MenuItem[];
  label?: string;
  className?: string;
  /** Custom trigger content; defaults to a ⋯ icon. */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<AnchoredPosition | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const actionable = items.filter((i): i is Exclude<MenuItem, "separator"> => i !== "separator");

  function toggle() {
    if (open) return setOpen(false);
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos(anchorTo(r, { itemCount: items.length, minWidth: 200, align: "end", maxHeight: 360 }));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const els = Array.from(list.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? []);
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus({ preventScroll: true });
      }
    };
    const onScroll = () => setOpen(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (!actionable.length) return null;
  const itemClass = (destructive?: boolean) =>
    `flex min-h-10 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-left text-[0.9375rem] outline-none hover:bg-surface-2 focus:bg-surface-2 aria-disabled:pointer-events-none aria-disabled:opacity-40 ${destructive ? "text-fg font-medium" : ""}`;

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
        className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-fg ${open ? "bg-surface-2 text-fg" : ""} ${className}`}
      >
        {trigger ?? <MoreIcon />}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={list}
            id={id}
            role="menu"
            aria-label={label}
            style={pos.style}
            className={`floating z-[70] overflow-y-auto p-1 ${pos.above ? "animate-menu-up" : "animate-menu-in"}`}
          >
            {items.map((item, i) =>
              item === "separator" ? (
                <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-line" />
              ) : item.href ? (
                <a
                  key={item.label}
                  role="menuitem"
                  href={item.href}
                  target={item.newTab ? "_blank" : undefined}
                  rel={item.newTab ? "noreferrer" : undefined}
                  download={item.href.startsWith("/api/") ? "" : undefined}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => setOpen(false)}
                  className={itemClass()}
                >
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  aria-disabled={item.disabled || undefined}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect?.();
                  }}
                  className={itemClass(item.destructive)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
