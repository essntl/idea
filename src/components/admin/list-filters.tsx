"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { CloseIcon, FilterIcon, SearchIcon } from "@/components/ui/icons";

type Option = { slug: string; name: string };
type Values = { q?: string; status?: string; category?: string; tag?: string; sort?: string };

const SORTS = [
  { value: "updated", label: "Recently edited" },
  { value: "published", label: "Publish date" },
  { value: "title", label: "Title" },
];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/**
 * Search field + one "Filters" control. Phones get a sheet with chip groups; wider screens get inline selects.
 * Active filters show as removable chips.
 */
export function ListFilters({
  action,
  values,
  statuses,
  categories,
  tags,
}: {
  action: string;
  values: Values;
  statuses: string[];
  categories?: Option[];
  tags: Option[];
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Values>(values);

  const go = (v: Values) => {
    const sp = new URLSearchParams(Object.entries(v).filter((e): e is [string, string] => !!e[1] && !(e[0] === "sort" && e[1] === "updated")));
    router.push(sp.size ? `${action}?${sp}` : action);
  };
  const set = (patch: Values) => go({ ...values, ...patch });

  const active = [
    values.status && { key: "status", label: cap(values.status) },
    values.category && { key: "category", label: categories?.find((c) => c.slug === values.category)?.name ?? values.category },
    values.tag && { key: "tag", label: `#${tags.find((t) => t.slug === values.tag)?.name ?? values.tag}` },
  ].filter(Boolean) as { key: keyof Values; label: string }[];

  const chipGroup = (title: string, key: keyof Values, options: { value: string; label: string }[]) => (
    <fieldset className="mt-5 first:mt-1">
      <legend className="mb-2 text-sm font-medium text-muted">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value || "all"} type="button" className="chip" aria-pressed={(draft[key] ?? (key === "sort" ? "updated" : "")) === o.value} onClick={() => setDraft((d) => ({ ...d, [key]: o.value || undefined }))}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="mb-5">
      <div className="flex gap-2">
        <form
          role="search"
          className="relative min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: (new FormData(e.currentTarget).get("q") as string) || undefined });
          }}
        >
          <SearchIcon width={16} height={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle" />
          <label htmlFor="f-q" className="sr-only">
            Search
          </label>
          <input id="f-q" name="q" type="search" defaultValue={values.q} placeholder="Search titles" className="field pl-10" />
        </form>

        {/* Phones: one button that opens the filter sheet. */}
        <button
          type="button"
          className="btn btn-ghost relative shrink-0 px-3 md:hidden"
          onClick={() => {
            setDraft(values);
            setSheetOpen(true);
          }}
          aria-label={`Filters${active.length ? ` (${active.length} active)` : ""}`}
        >
          <FilterIcon width={18} height={18} />
          {active.length > 0 && <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-fg text-[0.7rem] font-semibold text-bg">{active.length}</span>}
        </button>

        {/* Wider screens: compact inline selects. */}
        <div className="hidden shrink-0 gap-2 md:flex">
          <Select aria-label="Status" className="field w-36" value={values.status ?? ""} onChange={(v) => set({ status: v || undefined })} options={[{ value: "", label: "All statuses" }, ...statuses.map((s) => ({ value: s, label: cap(s) }))]} />
          {categories && (
            <Select aria-label="Category" className="field w-40" value={values.category ?? ""} onChange={(v) => set({ category: v || undefined })} options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]} />
          )}
          <Select aria-label="Tag" className="field w-36" value={values.tag ?? ""} onChange={(v) => set({ tag: v || undefined })} options={[{ value: "", label: "All tags" }, ...tags.map((t) => ({ value: t.slug, label: t.name }))]} />
          <Select aria-label="Sort" className="field w-44" value={values.sort ?? "updated"} onChange={(v) => set({ sort: v })} options={SORTS} />
        </div>
      </div>

      {active.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
          {active.map((f) => (
            <li key={f.key}>
              <button type="button" className="chip gap-1 bg-surface pr-2 text-fg" onClick={() => set({ [f.key]: undefined })} aria-label={`Remove filter ${f.label}`}>
                {f.label}
                <CloseIcon width={14} height={14} />
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="chip border-transparent underline-offset-2 hover:underline" onClick={() => go({ q: values.q, sort: values.sort })}>
              Clear all
            </button>
          </li>
        </ul>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        footer={
          <>
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setDraft({ q: values.q })}>
              Reset
            </button>
            <button
              type="button"
              className="btn flex-1"
              onClick={() => {
                setSheetOpen(false);
                go({ ...draft, q: values.q });
              }}
            >
              Show results
            </button>
          </>
        }
      >
        {chipGroup("Status", "status", [{ value: "", label: "All" }, ...statuses.map((s) => ({ value: s, label: cap(s) }))])}
        {categories && categories.length > 0 && chipGroup("Category", "category", [{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))])}
        {tags.length > 0 && chipGroup("Tag", "tag", [{ value: "", label: "All" }, ...tags.map((t) => ({ value: t.slug, label: t.name }))])}
        {chipGroup("Sort by", "sort", SORTS)}
      </Sheet>
    </div>
  );
}
