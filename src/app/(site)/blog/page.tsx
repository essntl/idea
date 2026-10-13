import type { Metadata } from "next";
import { listBlogPosts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { pageParam } from "@/lib/format";
import { BlogList } from "@/components/site/blog-list";
import { Pagination } from "@/components/site/pagination";

export const metadata: Metadata = { title: "Blog", description: "Diary notes, newest first.", alternates: { canonical: "/blog" } };

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const page = pageParam((await searchParams).page);
  const { postsPerPage } = await getSettings();
  const { items, total } = await listBlogPosts({ page, perPage: postsPerPage });
  return (
    <div className="container-prose">
      <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
      <p className="mt-2 mb-8 text-muted">Diary notes, newest first.</p>
      <BlogList items={items} />
      <Pagination page={page} total={total} perPage={postsPerPage} basePath="/blog" />
    </div>
  );
}
