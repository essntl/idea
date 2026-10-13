import type { Metadata } from "next";
import Link from "next/link";
import { search, HL_START, HL_STOP } from "@/lib/search";
import { DateText } from "@/components/site/date-text";
import { SearchIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

/** Renders ts_headline output with <mark> without injecting HTML. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${HL_START}[^${HL_STOP}]*${HL_STOP})`));
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith(HL_START) ? (
          <mark key={i} className="bg-line text-fg">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 200).trim() ?? "";
  const results = q ? await search(q) : [];
  return (
    <div className="container-prose">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <form action="/search" method="get" role="search" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search articles and posts
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Search articles and posts" className="field" autoFocus={!q} />
        <button type="submit" className="btn" aria-label="Search">
          <SearchIcon width={18} height={18} />
        </button>
      </form>
      {q && (
        <p className="mt-6 text-sm text-muted" role="status">
          {results.length === 0 ? "No results." : `${results.length} result${results.length === 1 ? "" : "s"}`}
        </p>
      )}
      {results.length > 0 && (
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {results.map((r) => (
            <li key={r.url} className="py-5">
              <div className="text-sm text-muted">
                {r.kind === "article" ? "Article" : "Blog"} · <DateText iso={r.publishedAt} style="short" />
              </div>
              <h2 className="mt-1 text-lg font-semibold leading-snug">
                <Link href={r.url} className="hover:underline">
                  {r.title}
                </Link>
              </h2>
              <p className="mt-1 text-muted">
                <Snippet text={r.snippet} />
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
