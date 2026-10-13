import { notFound } from "next/navigation";
import Image from "next/image";
import { requireAdminPage } from "@/lib/guard";
import { prisma } from "@/lib/db";
import type { TocItem } from "@/lib/content/pipeline";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Prose } from "@/components/site/prose";
import { TableOfContents } from "@/components/site/toc";
import { TagList } from "@/components/site/tag-list";
import { DateText } from "@/components/site/date-text";

export const metadata = { title: "Preview", robots: { index: false, follow: false } };

/** Renders a post exactly as the public page would, including drafts. Admin only. */
export default async function PreviewPage({ params }: PageProps<"/admin/preview/[type]/[id]">) {
  await requireAdminPage();
  const { type, id } = await params;
  const now = new Date().toISOString();
  let body: React.ReactNode;

  if (type === "blog") {
    const p = await prisma.blogPost.findUnique({ where: { id }, include: { tags: { select: { name: true, slug: true } } } });
    if (!p) notFound();
    body = (
      <article className="container-prose">
        <header className="mb-10">
          <DateText iso={p.publishedAt?.toISOString() ?? now} className="text-sm text-muted" />
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{p.title || "Untitled"}</h1>
          {p.description && <p className="mt-3 text-lg text-muted">{p.description}</p>}
        </header>
        <Prose html={p.contentHtml} />
        <div className="mt-12 -ml-1.5 border-t border-line pt-6"><TagList tags={p.tags} base="/blog/tag" /></div>
      </article>
    );
  } else if (type === "article") {
    const a = await prisma.article.findUnique({ where: { id }, include: { tags: { select: { name: true, slug: true } }, category: true, previewImage: true } });
    if (!a) notFound();
    body = (
      <article>
        <header className="container-prose">
          <div className="flex flex-wrap gap-x-2 text-sm text-muted">
            {a.category && <span>{a.category.name} ·</span>}
            <DateText iso={a.publishedAt?.toISOString() ?? now} /> · <span>{a.readingTime} min read</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-[2.5rem]">{a.title || "Untitled"}</h1>
          {a.excerpt && <p className="mt-4 text-lg text-muted">{a.excerpt}</p>}
        </header>
        {a.previewImage && (
          <figure className="container-wide mt-8 sm:mt-10">
            <Image src={`/media/${a.previewImage.path}`} alt={a.previewImage.alt} width={a.previewImage.width} height={a.previewImage.height} sizes="(min-width: 1024px) 976px, 100vw" priority className="mx-auto max-h-[70vh] w-full border border-line object-cover" />
          </figure>
        )}
        <div className="container-prose mt-10">
          <TableOfContents items={(a.toc as TocItem[]) ?? []} />
          <Prose html={a.contentHtml} />
          <div className="mt-12 -ml-1.5"><TagList tags={a.tags} base="/articles/tag" /></div>
        </div>
      </article>
    );
  } else notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-fg py-2 text-center text-sm text-bg">Preview — not visible to visitors until published</div>
      <SiteHeader />
      <main className="flex-1 pt-8 pb-16 sm:pt-12">{body}</main>
      <SiteFooter />
    </div>
  );
}
