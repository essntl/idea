import { prisma } from "./db";

export type SearchHit = { kind: "article" | "blog"; title: string; url: string; snippet: string; publishedAt: string };

/** Builds a prefix-matching tsquery ("foo bar" → "foo:* & bar:*") from free text; null if nothing searchable. */
export function toTsQuery(input: string): string | null {
  const terms = (input.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
  return terms.length ? terms.map((t) => `${t}:*`).join(" & ") : null;
}

/** Snippet highlight delimiters; rendered as <mark> by the search page without using raw HTML. */
export const HL_START = "\u0002";
export const HL_STOP = "\u0003";

export async function search(q: string, limit = 30): Promise<SearchHit[]> {
  const tsq = toTsQuery(q);
  if (!tsq) return [];
  const opts = `StartSel=${HL_START}, StopSel=${HL_STOP}, MaxWords=30, MinWords=12, ShortWord=2, MaxFragments=1`;
  const rows = await prisma.$queryRaw<{ kind: "article" | "blog"; title: string; slug: string; snippet: string; publishedAt: Date; rank: number }[]>`
    WITH q AS (SELECT to_tsquery('simple', ${tsq}) AS query)
    SELECT * FROM (
      SELECT 'article' AS kind, a."title", a."slug", a."publishedAt",
        ts_headline('simple', a."excerpt" || ' ' || a."contentText", q.query, ${opts}) AS snippet,
        ts_rank(to_tsvector('simple', coalesce(a."title", '') || ' ' || coalesce(a."excerpt", '') || ' ' || coalesce(a."contentText", '')), q.query)
          + CASE WHEN to_tsvector('simple', a."title") @@ q.query THEN 1 ELSE 0 END AS rank
      FROM "Article" a, q
      WHERE a."status" IN ('published', 'scheduled') AND a."publishedAt" <= now()
        AND to_tsvector('simple', coalesce(a."title", '') || ' ' || coalesce(a."excerpt", '') || ' ' || coalesce(a."contentText", '')) @@ q.query
      UNION ALL
      SELECT 'blog' AS kind, b."title", b."slug", b."publishedAt",
        ts_headline('simple', b."description" || ' ' || b."contentText", q.query, ${opts}) AS snippet,
        ts_rank(to_tsvector('simple', coalesce(b."title", '') || ' ' || coalesce(b."description", '') || ' ' || coalesce(b."contentText", '')), q.query)
          + CASE WHEN to_tsvector('simple', b."title") @@ q.query THEN 1 ELSE 0 END AS rank
      FROM "BlogPost" b, q
      WHERE b."status" IN ('published', 'scheduled') AND b."publishedAt" <= now()
        AND to_tsvector('simple', coalesce(b."title", '') || ' ' || coalesce(b."description", '') || ' ' || coalesce(b."contentText", '')) @@ q.query
    ) results
    ORDER BY rank DESC, "publishedAt" DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    kind: r.kind,
    title: r.title,
    url: r.kind === "article" ? `/articles/${r.slug}` : `/blog/${r.slug}`,
    snippet: r.snippet,
    publishedAt: new Date(r.publishedAt).toISOString(),
  }));
}
