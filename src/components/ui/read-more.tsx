"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Clamps tall content (default ≈12 lines) with a "Read more" toggle. Measured after mount,
 * so the server always renders full content and nothing shifts for short text.
 */
export function ReadMore({ children, maxHeight = 300, className = "" }: { children: React.ReactNode; maxHeight?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > maxHeight + 48);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxHeight]);

  const clamped = overflows && !open;
  return (
    <div className={className}>
      <div ref={ref} style={clamped ? { maxHeight, overflow: "hidden" } : undefined}>
        {children}
      </div>
      {overflows && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 text-sm font-medium underline-offset-4 hover:underline">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
