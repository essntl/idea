import type { TocItem } from "@/lib/content/pipeline";
import { ChevronDown } from "@/components/ui/icons";

export function TableOfContents({ items }: { items: TocItem[] }) {
  if (items.length < 2) return null;
  const minLevel = Math.min(...items.map((i) => i.level));
  return (
    <details className="group mb-10 border-y border-line" open>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
        Contents
        <ChevronDown width={16} height={16} className="transition-transform group-open:rotate-180" />
      </summary>
      <nav aria-label="Table of contents" className="pb-4">
        <ol className="text-[0.9375rem]">
          {items.map((i) => (
            <li key={i.id} style={{ paddingLeft: `${(i.level - minLevel) * 1}rem` }}>
              <a href={`#${i.id}`} className="block py-1.5 text-muted hover:text-fg hover:underline">
                {i.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
