import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTag, listBlogPosts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { pageParam } from "@/lib/format";
import { BlogList } from "@/components/site/blog-list";
import { Pagination } from "@/components/site/pagination";

export async function generateMetadata({ params }: PageProps<"/blog/tag/[tag]">): Promise<Metadata> {
  const tag = await getTag((await params).tag);
  return tag ? { title: `#${tag.name} — Blog`, alternates: { canonical: `/blog/tag/${tag.slug}` } } : {};
}

export default async function BlogTagPage({ params, searchParams }: PageProps<"/blog/tag/[tag]">) {
  const [{ tag: slug }, sp] = await Promise.all([params, searchParams]);
  const tag = await getTag(slug);
  if (!tag) notFound();
  const page = pageParam(sp.page);
  const { postsPerPage } = await getSettings();
  const { items, total } = await listBlogPosts({ page, perPage: postsPerPage, tag: tag.slug });
  return (
    <div className="container-prose">
      <p className="text-sm text-muted">
        <Link href="/blog" className="hover:underline">Blog</Link> / tag
      </p>
      <h1 className="mt-1 mb-8 text-3xl font-semibold tracking-tight">#{tag.name}</h1>
      <BlogList items={items} />
      <Pagination page={page} total={total} perPage={postsPerPage} basePath={`/blog/tag/${tag.slug}`} />
    </div>
  );
}
