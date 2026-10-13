import Link from "next/link";
import type { TagDTO } from "@/lib/queries";

export function TagList({ tags, base }: { tags: TagDTO[]; base: "/blog/tag" | "/articles/tag" }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-1 gap-y-1 text-sm" aria-label="Tags">
      {tags.map((t) => (
        <li key={t.slug}>
          <Link href={`${base}/${t.slug}`} className="inline-flex min-h-8 items-center rounded-sm px-1.5 text-muted hover:bg-surface hover:text-fg">
            #{t.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
