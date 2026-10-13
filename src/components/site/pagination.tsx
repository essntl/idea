import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";

export function Pagination({ page, total, perPage, basePath }: { page: number; total: number; perPage: number; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const href = (p: number) => (p === 1 ? basePath : `${basePath}?page=${p}`);
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-between border-t border-line pt-6 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="tap gap-2 hover:underline" rel="prev">
          <ArrowLeft width={16} height={16} /> Newer
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="tap justify-end gap-2 hover:underline" rel="next">
          Older <ArrowRight width={16} height={16} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
