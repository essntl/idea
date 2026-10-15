import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost } from "@/lib/queries";
import { DateText } from "@/components/site/date-text";
import { Prose } from "@/components/site/prose";
import { TagList } from "@/components/site/tag-list";
import { ArrowLeft } from "@/components/ui/icons";
import { CommentSection } from "@/components/site/comments/comment-section";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await getBlogPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.publishedAt, modifiedTime: post.updatedAt },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = await getBlogPost((await params).slug);
  if (!post) notFound();
  return (
    <article className="container-prose">
      <header className="mb-10">
        <DateText iso={post.publishedAt} className="text-sm text-muted" />
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
        {post.description && <p className="mt-3 text-lg text-muted">{post.description}</p>}
      </header>
      <Prose html={post.contentHtml} />
      <footer className="mt-12 flex flex-col gap-6 border-t border-line pt-6">
        {post.tags.length > 0 && (
          <div className="-ml-1.5">
            <TagList tags={post.tags} base="/blog/tag" />
          </div>
        )}
        <Link href="/blog" className="tap gap-2 text-sm hover:underline">
          <ArrowLeft width={16} height={16} /> All posts
        </Link>
      </footer>
      <CommentSection targetType="blog" targetId={post.id} />
    </article>
  );
}
