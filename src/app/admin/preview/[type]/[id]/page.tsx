import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/guard";
import { prisma } from "@/lib/db";
import type { TocItem } from "@/lib/content/pipeline";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ImageLightbox } from "@/components/site/image-lightbox";
import { PreviewView, type PreviewData } from "@/components/admin/preview-view";

export const metadata = { title: "Preview", robots: { index: false, follow: false } };

/**
 * Admin-only preview. Renders the saved version from the database; when opened from the editor,
 * PreviewView replaces it with the editor's current (unsaved) state and keeps it in sync.
 */
export default async function PreviewPage({ params }: PageProps<"/admin/preview/[type]/[id]">) {
  await requireAdminPage();
  const { type, id } = await params;
  const categories = Object.fromEntries((await prisma.category.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  let data: PreviewData;

  if (type === "blog") {
    const p = await prisma.blogPost.findUnique({ where: { id }, include: { tags: { select: { name: true } } } });
    if (!p) notFound();
    data = {
      kind: "blog", id, title: p.title, description: p.description, html: p.contentHtml, toc: [], readingTime: 1,
      tags: p.tags.map((t) => t.name), publishedAt: p.publishedAt?.toISOString() ?? null, categoryId: null, previewImage: null,
    };
  } else if (type === "article") {
    const a = await prisma.article.findUnique({ where: { id }, include: { tags: { select: { name: true } }, previewImage: true } });
    if (!a) notFound();
    data = {
      kind: "article", id, title: a.title, description: a.excerpt, html: a.contentHtml, toc: (a.toc as TocItem[]) ?? [], readingTime: a.readingTime,
      tags: a.tags.map((t) => t.name), publishedAt: a.publishedAt?.toISOString() ?? null, categoryId: a.categoryId,
      previewImage: a.previewImage ? { url: `/media/${a.previewImage.path}`, width: a.previewImage.width, height: a.previewImage.height, alt: a.previewImage.alt } : null,
    };
  } else if (type === "project") {
    const p = await prisma.project.findUnique({ where: { id }, include: { previewImage: true } });
    if (!p) notFound();
    data = {
      kind: "project", id, title: p.title, description: p.summary, html: p.contentHtml, toc: [], readingTime: 1, tags: [],
      publishedAt: p.publishedAt?.toISOString() ?? null, categoryId: null,
      previewImage: p.previewImage ? { url: `/media/${p.previewImage.path}`, width: p.previewImage.width, height: p.previewImage.height, alt: p.previewImage.alt } : null,
      project: { phase: p.phase, repoUrl: p.repoUrl ?? "", siteUrl: p.siteUrl ?? "", packageUrl: p.packageUrl ?? "", stack: p.stack },
    };
  } else if (type === "page" && id === "about") {
    const p = await prisma.page.findUnique({ where: { key: "about" } });
    data = {
      kind: "page", id, title: p?.title ?? "About", description: "", html: p?.contentHtml ?? "", toc: [], readingTime: 1,
      tags: [], publishedAt: null, categoryId: null, previewImage: null,
    };
  } else notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 pt-8 pb-16 sm:pt-12">
        <PreviewView saved={data} categories={categories} />
      </main>
      <SiteFooter />
      <ImageLightbox />
    </div>
  );
}
