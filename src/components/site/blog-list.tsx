import Link from "next/link";
import type { BlogListItem } from "@/lib/queries";
import { DateText } from "./date-text";
import { TagList } from "./tag-list";

/** Diary list: date, title, description, tags — separated by thin lines. */
export function BlogList({ items }: { items: BlogListItem[] }) {
  if (!items.length) return <p className="py-10 text-muted">No posts yet.</p>;
  return (
    <ol className="divide-y divide-line border-y border-line">
      {items.map((p) => (
        <li key={p.id} className="py-6 sm:py-7">
          <article>
            <DateText iso={p.publishedAt} className="text-sm text-muted" />
            <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight sm:text-xl">
              <Link href={`/blog/${p.slug}`} className="hover:underline">
                {p.title}
              </Link>
            </h2>
            {p.description && <p className="mt-1.5 text-muted">{p.description}</p>}
            {p.tags.length > 0 && (
              <div className="mt-2 -ml-1.5">
                <TagList tags={p.tags} base="/blog/tag" />
              </div>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}
