import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTag, listArticles } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { pageParam } from "@/lib/format";
import { ArticleList } from "@/components/site/article-list";
import { Pagination } from "@/components/site/pagination";

export async function generateMetadata({ params }: PageProps<"/articles/tag/[slug]">): Promise<Metadata> {
  const tag = await getTag((await params).slug);
  return tag ? { title: `#${tag.name} — Articles`, alternates: { canonical: `/articles/tag/${tag.slug}` } } : {};
}

export default async function ArticleTagPage({ params, searchParams }: PageProps<"/articles/tag/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tag = await getTag(slug);
  if (!tag) notFound();
  const page = pageParam(sp.page);
  const { postsPerPage } = await getSettings();
  const { items, total } = await listArticles({ page, perPage: postsPerPage, tag: tag.slug });
  return (
    <div className="container-wide">
      <p className="text-sm text-muted">
        <Link href="/articles" className="hover:underline">Articles</Link> / tag
      </p>
      <h1 className="mt-1 mb-10 text-3xl font-semibold tracking-tight">#{tag.name}</h1>
      <ArticleList items={items} priorityFirst />
      <Pagination page={page} total={total} perPage={postsPerPage} basePath={`/articles/tag/${tag.slug}`} />
    </div>
  );
}
