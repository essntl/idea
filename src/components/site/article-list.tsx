import Image from "next/image";
import Link from "next/link";
import type { ArticleListItem } from "@/lib/queries";
import { DateText } from "./date-text";

export function ArticleList({ items, priorityFirst = false }: { items: ArticleListItem[]; priorityFirst?: boolean }) {
  if (!items.length) return <p className="py-10 text-muted">No articles yet.</p>;
  return (
    <ul className="grid gap-x-10 gap-y-12 md:grid-cols-2">
      {items.map((a, i) => (
        <li key={a.id}>
          <ArticleCard article={a} priority={priorityFirst && i === 0} />
        </li>
      ))}
    </ul>
  );
}

export function ArticleCard({ article: a, priority = false }: { article: ArticleListItem; priority?: boolean }) {
  return (
    <article className="group">
      <Link href={`/articles/${a.slug}`} className="block" tabIndex={-1} aria-hidden="true">
        <div className="relative aspect-[16/9] overflow-hidden border border-line bg-surface">
          {a.previewImage && (
            <Image
              src={a.previewImage.url}
              alt={a.previewImage.alt || ""}
              fill
              sizes="(min-width: 1024px) 480px, (min-width: 768px) 45vw, 100vw"
              className="object-cover transition-opacity group-hover:opacity-90"
              priority={priority}
            />
          )}
        </div>
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 text-sm text-muted">
        <DateText iso={a.publishedAt} style="short" />
        <span aria-hidden="true">·</span>
        <span>{a.readingTime} min read</span>
        {a.category && (
          <>
            <span aria-hidden="true">·</span>
            <Link href={`/articles/category/${a.category.slug}`} className="hover:text-fg hover:underline">
              {a.category.name}
            </Link>
          </>
        )}
      </div>
      <h2 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight">
        <Link href={`/articles/${a.slug}`} className="hover:underline">
          {a.title}
        </Link>
      </h2>
      {a.excerpt && <p className="mt-2 line-clamp-3 text-muted">{a.excerpt}</p>}
    </article>
  );
}
