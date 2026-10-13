import Link from "next/link";

export function AdminPagination({ base, params, page, total, perPage }: { base: string; params: Record<string, string | undefined>; page: number; total: number; perPage: number }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter((e): e is [string, string] => !!e[1]));
    return `${base}?${sp}`;
  };
  return (
    <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
      {page > 1 ? <Link className="tap underline" href={href(page - 1)}>← Previous</Link> : <span />}
      <span className="text-muted">Page {page} of {pages} · {total} items</span>
      {page < pages ? <Link className="tap underline" href={href(page + 1)}>Next →</Link> : <span />}
    </nav>
  );
}
