import type { JSONContent } from "@tiptap/core";
import { prisma } from "../db";
import { toMediaItem } from "./media-service";
import type { EditorInitial } from "@/components/admin/post-editor";
import { EMPTY_DOC } from "../content/extensions";

export async function tagSuggestions() {
  return (await prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } })).map((t) => t.name);
}

export async function blogEditorData(id: string): Promise<EditorInitial | null> {
  const p = await prisma.blogPost.findUnique({ where: { id }, include: { tags: { select: { name: true } } } });
  if (!p) return null;
  return {
    id: p.id, title: p.title, description: p.description, contentJson: (p.contentJson as JSONContent) ?? EMPTY_DOC,
    tags: p.tags.map((t) => t.name), status: p.status, publishedAt: p.publishedAt?.toISOString() ?? null, slug: p.slug,
    categoryId: null, previewImage: null, seoTitle: "", seoDescription: "", publicUrl: `/blog/${p.slug}`,
  };
}

export async function articleEditorData(id: string): Promise<EditorInitial | null> {
  const a = await prisma.article.findUnique({ where: { id }, include: { tags: { select: { name: true } }, previewImage: true } });
  if (!a) return null;
  return {
    id: a.id, title: a.title, description: a.excerpt, contentJson: (a.contentJson as JSONContent) ?? EMPTY_DOC,
    tags: a.tags.map((t) => t.name), status: a.status, publishedAt: a.publishedAt?.toISOString() ?? null, slug: a.slug,
    categoryId: a.categoryId, previewImage: a.previewImage ? toMediaItem(a.previewImage) : null,
    seoTitle: a.seoTitle ?? "", seoDescription: a.seoDescription ?? "", publicUrl: `/articles/${a.slug}`,
  };
}
