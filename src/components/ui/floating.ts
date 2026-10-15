/** Position for a popover anchored to a trigger, kept inside the viewport (used by Select and Menu). */
export type AnchoredPosition = {
  /** Ready-to-use fixed-position style. Popovers above the trigger are anchored by `bottom`, so no transform is needed
   * (a transform would fight the open animation and make the popover jump). */
  style: { position: "fixed"; left: number; top?: number; bottom?: number; minWidth: number; maxHeight: number };
  above: boolean;
};

export function anchorTo(
  rect: DOMRect,
  opts: { itemCount: number; minWidth?: number; align?: "start" | "end"; maxHeight?: number },
): AnchoredPosition {
  const cap = opts.maxHeight ?? 288;
  const below = window.innerHeight - rect.bottom - 8;
  const above = rect.top - 8;
  const wanted = Math.min(cap, opts.itemCount * 40 + 8);
  const showAbove = below < Math.min(wanted, 200) && above > below;
  const maxHeight = Math.max(120, Math.min(cap, showAbove ? above : below) - 4);
  const minWidth = Math.max(opts.align === "end" ? 0 : rect.width, opts.minWidth ?? 160);
  const preferred = opts.align === "end" ? rect.right - minWidth : rect.left;
  const left = Math.max(8, Math.min(preferred, window.innerWidth - minWidth - 8));
  const vertical = showAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 };
  return { style: { position: "fixed", left, minWidth, maxHeight, ...vertical }, above: showAbove };
}
