import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getArticle, getArticleNeighbours, getRelatedArticles } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";
import { DateText } from "@/components/site/date-text";
import { Prose } from "@/components/site/prose";
import { TagList } from "@/components/site/tag-list";
import { TableOfContents } from "@/components/site/toc";
import { ArticleCard } from "@/components/site/article-list";
import { CommentSection } from "@/components/site/comments/comment-section";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";

export async function generateMetadata({ params }: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a) return {};
  const title = a.seoTitle || a.title;
  const description = a.seoDescription || a.excerpt || undefined;
  const image = a.previewImage
    ? [{ url: `${a.previewImage.url}?w=1200`, width: 1200, height: Math.round((1200 * a.previewImage.height) / a.previewImage.width), alt: a.previewImage.alt || a.title }]
    : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/articles/${a.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/articles/${a.slug}`,
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt,
      section: a.category?.name,
      tags: a.tags.map((t) => t.name),
      images: image,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image?.map((i) => i.url) },
  };
}

export default async function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  const article = await getArticle((await params).slug);
  if (!article) notFound();
  const [{ prev, next }, related, settings, nonce] = await Promise.all([
    getArticleNeighbours(article.publishedAt, article.id),
    getRelatedArticles(article.categoryId, article.id),
    getSettings(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seoDescription || article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: `${base}/articles/${article.slug}`,
    url: `${base}/articles/${article.slug}`,
    image: article.previewImage ? [`${base}${article.previewImage.url}?w=1200`] : undefined,
    author: { "@type": "Person", name: settings.authorName, url: settings.portfolioUrl || undefined },
    publisher: { "@type": "Person", name: settings.authorName },
    articleSection: article.category?.name,
    keywords: article.tags.map((t) => t.name).join(", ") || undefined,
  };

  return (
    <article>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="container-prose">
        <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          {article.category && (
            <>
              <Link href={`/articles/category/${article.category.slug}`} className="hover:text-fg hover:underline">
                {article.category.name}
              </Link>
              <span aria-hidden="true">·</span>
            </>
          )}
          <DateText iso={article.publishedAt} />
          <span aria-hidden="true">·</span>
          <span>{article.readingTime} min read</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-[2.5rem]">{article.title}</h1>
        {article.excerpt && <p className="mt-4 text-lg text-muted">{article.excerpt}</p>}
      </header>

      {article.previewImage && (
        <figure className="container-wide mt-8 sm:mt-10" data-zoomable>
          <Image
            src={article.previewImage.url}
            alt={article.previewImage.alt || ""}
            width={article.previewImage.width}
            height={article.previewImage.height}
            sizes="(min-width: 1024px) 976px, 100vw"
            priority
            className="mx-auto max-h-[70vh] w-full rounded-[var(--radius-xl)] object-cover"
          />
        </figure>
      )}

      <div className="container-prose mt-10">
        <TableOfContents items={article.toc} />
        <Prose html={article.contentHtml} />

        {article.tags.length > 0 && (
          <div className="mt-12 -ml-1.5">
            <TagList tags={article.tags} base="/articles/tag" />
          </div>
        )}

        {(prev || next) && (
          <nav aria-label="More articles" className="mt-10 grid gap-3 sm:grid-cols-2">
            {prev ? (
              <Link href={`/articles/${prev.slug}`} className="group flex min-h-16 flex-col justify-center rounded-[var(--radius-lg)] border border-line px-4 py-3 hover:bg-surface">
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <ArrowLeft width={14} height={14} /> Previous
                </span>
                <span className="mt-1 font-medium">{prev.title}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next && (
              <Link href={`/articles/${next.slug}`} className="group flex min-h-16 flex-col justify-center rounded-[var(--radius-lg)] border border-line px-4 py-3 hover:bg-surface sm:col-start-2 sm:text-right">
                <span className="flex items-center gap-1.5 text-sm text-muted sm:justify-end">
                  Next <ArrowRight width={14} height={14} />
                </span>
                <span className="mt-1 font-medium">{next.title}</span>
              </Link>
            )}
          </nav>
        )}

        <CommentSection targetType="article" targetId={article.id} />
      </div>

      {related.length > 0 && (
        <aside aria-labelledby="related-title" className="container-wide mt-20 border-t border-line pt-10">
          <h2 id="related-title" className="mb-6 text-sm font-medium uppercase tracking-wider text-muted">
            Related in {article.category?.name}
          </h2>
          <ul className="grid gap-x-8 gap-y-10 md:grid-cols-3">
            {related.map((r) => (
              <li key={r.id}>
                <ArticleCard article={r} />
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
