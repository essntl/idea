"use client";

import { useId } from "react";

type Props = { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean };

/** Settings row: label + description on the left, toggle on the right. */
export function Switch({ checked, onChange, label, description, disabled }: Props) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[0.9375rem] font-medium">
          {label}
        </label>
        {description && (
          <p id={`${id}-d`} className="mt-0.5 text-sm text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-40 ${checked ? "bg-fg" : "bg-surface-2"}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 left-1 size-5 rounded-full shadow-sm transition-transform duration-200 ${checked ? "translate-x-5 bg-bg" : "bg-line-strong"}`}
        />
      </button>
    </div>
  );
}
