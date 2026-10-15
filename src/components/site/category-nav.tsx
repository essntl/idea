import Link from "next/link";
import { getCategories } from "@/lib/queries";

export async function CategoryNav({ active }: { active?: string }) {
  const categories = (await getCategories()).filter((c) => c.count > 0);
  if (!categories.length) return null;
  const item = (href: string, label: string, current: boolean) => (
    <li key={href}>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${current ? "border-fg bg-fg text-bg" : "border-line text-muted hover:bg-surface hover:text-fg"}`}
      >
        {label}
      </Link>
    </li>
  );
  return (
    <nav aria-label="Categories" className="mb-10">
      <ul className="flex flex-wrap gap-2">
        {item("/articles", "All", !active)}
        {categories.map((c) => item(`/articles/category/${c.slug}`, c.name, active === c.slug))}
      </ul>
    </nav>
  );
}
