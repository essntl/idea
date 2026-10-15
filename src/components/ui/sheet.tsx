"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Sticky action row at the bottom (e.g. Cancel / Save). */
  footer?: React.ReactNode;
  /** Wider modal on desktop. */
  size?: "md" | "lg";
};

/**
 * One dialog for the whole admin: a bottom sheet on phones, a centered modal from `sm` up.
 * Built on <dialog> (focus trap, Esc, inert background). Click on the backdrop closes it.
 */
export function Sheet({ open, onClose, title, children, footer, size = "md" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`fixed inset-x-0 bottom-0 m-0 mt-auto max-h-[88dvh] w-full max-w-none animate-sheet-in overflow-hidden rounded-t-[var(--radius-xl)] bg-bg p-0 text-fg shadow-[var(--shadow-float)] backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:max-h-[85vh] sm:rounded-[var(--radius-xl)] sm:border sm:border-line ${
        size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
      }`}
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col sm:max-h-[85vh]">
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-2 sm:pt-4">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg">
              <CloseIcon width={18} height={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer && <div className="flex shrink-0 gap-2 border-t border-line bg-bg px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
