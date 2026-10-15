"use client";

import { useId, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";

/** Multi-select for tags: pick existing ones (datalist) or type a new name and press Enter. */
export function TagsInput({
  value,
  onChange,
  suggestions,
  placeholder = "Add a tag and press Enter",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const next = [...value];
    for (const n of names) if (!next.some((t) => t.toLowerCase() === n.toLowerCase())) next.push(n.slice(0, 50));
    onChange(next);
    setDraft("");
  }

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pr-1 pl-3 text-sm">
              {t}
              <button type="button" className="inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-line-strong/50 hover:text-fg" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>
                <CloseIcon width={12} height={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        className="field"
        list={`${id}-list`}
        value={draft}
        placeholder={placeholder}
        aria-label="Add tag"
        onChange={(e) => {
          const v = e.target.value;
          // Selecting a datalist option fills the value without a keypress.
          if (suggestions.includes(v)) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
      />
      <datalist id={`${id}-list`}>
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
