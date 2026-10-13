import type { Metadata } from "next";
import { listArticles } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { pageParam } from "@/lib/format";
import { ArticleList } from "@/components/site/article-list";
import { CategoryNav } from "@/components/site/category-nav";
import { Pagination } from "@/components/site/pagination";

export const metadata: Metadata = { title: "Articles", description: "Long-form articles.", alternates: { canonical: "/articles" } };

export default async function ArticlesPage({ searchParams }: PageProps<"/articles">) {
  const page = pageParam((await searchParams).page);
  const { postsPerPage } = await getSettings();
  const { items, total } = await listArticles({ page, perPage: postsPerPage });
  return (
    <div className="container-wide">
      <h1 className="text-3xl font-semibold tracking-tight">Articles</h1>
      <p className="mt-2 mb-8 text-muted">Long-form writing.</p>
      <CategoryNav />
      <ArticleList items={items} priorityFirst />
      <Pagination page={page} total={total} perPage={postsPerPage} basePath="/articles" />
    </div>
  );
}
