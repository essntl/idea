import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory, listArticles } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { pageParam } from "@/lib/format";
import { ArticleList } from "@/components/site/article-list";
import { CategoryNav } from "@/components/site/category-nav";
import { Pagination } from "@/components/site/pagination";

export async function generateMetadata({ params }: PageProps<"/articles/category/[slug]">): Promise<Metadata> {
  const c = await getCategory((await params).slug);
  return c ? { title: c.name, description: c.description || undefined, alternates: { canonical: `/articles/category/${c.slug}` } } : {};
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/articles/category/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) notFound();
  const page = pageParam(sp.page);
  const { postsPerPage } = await getSettings();
  const { items, total } = await listArticles({ page, perPage: postsPerPage, category: category.slug });
  return (
    <div className="container-wide">
      <h1 className="text-3xl font-semibold tracking-tight">{category.name}</h1>
      <p className="mt-2 mb-8 text-muted">{category.description || "Articles in this category."}</p>
      <CategoryNav active={category.slug} />
      <ArticleList items={items} priorityFirst />
      <Pagination page={page} total={total} perPage={postsPerPage} basePath={`/articles/category/${category.slug}`} />
    </div>
  );
}
