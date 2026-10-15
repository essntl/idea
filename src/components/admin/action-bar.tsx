"use client";

/** Floating bottom bar for contextual actions (bulk selection, unsaved settings). */
export function ActionBar({ children, label }: { children: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pl-60">
      <div role="region" aria-label="Actions" className="floating pointer-events-auto flex w-full max-w-xl animate-sheet-in items-center gap-2 p-2 pl-4">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      </div>
    </div>
  );
}
