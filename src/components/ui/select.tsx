"use client";

import { useCallback, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "./icons";
import { anchorTo, type AnchoredPosition } from "./floating";

const LIST_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End", "Enter"]);

export type SelectOption = { value: string; label: string; hint?: string };

type Props = {
  options: SelectOption[];
  /** Controlled value. Omit and use `defaultValue` for uncontrolled use (e.g. GET filter forms). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Renders a hidden input so the value is submitted with a surrounding <form>. */
  name?: string;
  id?: string;
  "aria-label"?: string;
  className?: string;
  size?: "md" | "sm";
  /** Keep focus where it is when opening (used inside the editor so the text selection survives). */
  preserveFocus?: boolean;
  disabled?: boolean;
};

/**
 * Styled replacement for <select>: rounded trigger + floating listbox (portal, so it is never clipped).
 * Keyboard: ↑/↓/Home/End move, Enter/Space choose, Esc closes, typing jumps to a matching option.
 */
export function Select({
  options, value, defaultValue, onChange, name, id, className = "", size = "md", preserveFocus = false, disabled = false, ...aria
}: Props) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<AnchoredPosition | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === current));
  const selected = options[selectedIndex];

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (r) setPos(anchorTo(r, { itemCount: options.length }));
  }, [options.length]);

  function openList() {
    if (disabled) return;
    setActive(selectedIndex);
    place();
    setOpen(true);
  }

  function choose(i: number) {
    const o = options[i];
    if (!o) return;
    if (value === undefined) setInner(o.value);
    onChange?.(o.value);
    setOpen(false);
    if (!preserveFocus) trigger.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);


  function onKeyDown(e: { key: string; timeStamp: number; preventDefault: () => void }) {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(last, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : last);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key.length === 1) {
      const now = e.timeStamp;
      typed.current = { text: (now - typed.current.at > 600 ? "" : typed.current.text) + e.key.toLowerCase(), at: now };
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
    }
  }

  const handleListKey = useEffectEvent((e: KeyboardEvent) => onKeyDown(e));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) setOpen(false);
    };
    // When focus stays elsewhere (preserveFocus, e.g. inside the editor) the open list still owns the keyboard.
    const onEsc = (e: KeyboardEvent) => {
      if (document.activeElement === trigger.current) return; // the trigger's own handler runs
      if (e.key === "Escape" || (preserveFocus && LIST_KEYS.has(e.key))) {
        e.preventDefault();
        e.stopPropagation();
        handleListKey(e);
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    window.addEventListener("keydown", onEsc, true);
    return () => {
      window.removeEventListener("keydown", onEsc, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place, preserveFocus]); // handleListKey is an effect event

  const sizing = size === "sm" ? "min-h-8 px-2.5 text-xs" : "min-h-11 px-3 text-[0.9375rem]";

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={aria["aria-label"]}
        disabled={disabled}
        onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`inline-flex items-center justify-between gap-2 rounded-[var(--radius-md)] text-left whitespace-nowrap outline-none disabled:opacity-40 ${sizing} ${className}`}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown width={14} height={14} className={`shrink-0 opacity-60 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      {open &&
        pos &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-activedescendant={`${listId}-${active}`}
            onMouseDown={(e) => e.preventDefault()}
            style={pos.style}
            className={`floating z-[70] overflow-y-auto p-1 text-[0.9375rem] text-fg [scrollbar-width:thin] ${pos.above ? "animate-menu-up" : "animate-menu-in"}`}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === current}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex min-h-9 cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-sm)] px-2.5 py-1.5 ${i === active ? "bg-surface-2" : ""} ${o.value === current ? "font-medium text-fg" : "text-muted"}`}
              >
                <span className="flex flex-col">
                  {o.label}
                  {o.hint && <span className="text-xs font-normal text-subtle">{o.hint}</span>}
                </span>
                {o.value === current && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
