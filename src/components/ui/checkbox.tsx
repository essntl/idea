"use client";

import { useEffect, useRef } from "react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  label?: React.ReactNode;
  /** Visually hidden label (for row checkboxes). */
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
};

/** Styled checkbox: a real (visually hidden) input for a11y + a rounded box. Tap area is at least 44px. */
export function Checkbox({ checked, onChange, indeterminate = false, label, className = "", disabled, ...aria }: Props) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);
  const on = checked || indeterminate;
  return (
    <label
      className={`group inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2.5 select-none ${disabled ? "cursor-not-allowed opacity-40" : ""} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={input}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={aria["aria-label"]}
      />
      <span
        aria-hidden="true"
        className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg ${
          on ? "border-fg bg-fg text-bg" : "border-line-strong bg-bg group-hover:border-fg"
        }`}
      >
        {indeterminate ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
            <path d="M5 12h14" />
          </svg>
        ) : checked ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        ) : null}
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
