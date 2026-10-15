import type { JSONContent } from "@tiptap/core";
import { prisma } from "../db";
import { toMediaItem } from "./media-service";
import type { EditorInitial } from "@/components/admin/post-editor";
import { EMPTY_DOC } from "../content/extensions";
import { applyDraft, type DraftFields } from "./apply-draft";

export async function tagSuggestions() {
  return (await prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } })).map((t) => t.name);
}

/** Editor fields from live values, overlaid with pending changes when there are any. */
async function withDraft(live: DraftFields, draft: unknown) {
  const fields = applyDraft(live, draft);
  const image =
    fields.previewImageId === live.previewImageId || !fields.previewImageId
      ? null
      : await prisma.media.findUnique({ where: { id: fields.previewImageId } });
  return { fields, image };
}

export async function blogEditorData(id: string): Promise<EditorInitial | null> {
  const p = await prisma.blogPost.findUnique({ where: { id }, include: { tags: { select: { name: true } } } });
  if (!p) return null;
  const live: DraftFields = {
    title: p.title, description: p.description, contentJson: (p.contentJson as JSONContent) ?? EMPTY_DOC, tags: p.tags.map((t) => t.name),
    publishedAt: p.publishedAt?.toISOString() ?? null, slug: p.slug, categoryId: null, previewImageId: null, seoTitle: "", seoDescription: "",
  };
  const { fields } = await withDraft(live, p.draft);
  return {
    id: p.id, title: fields.title, description: fields.description, contentJson: fields.contentJson, tags: fields.tags,
    status: p.status, publishedAt: fields.publishedAt, slug: p.slug, categoryId: null, previewImage: null, seoTitle: "", seoDescription: "",
    publicUrl: `/blog/${p.slug}`, pendingDraftAt: p.draft ? (p.draftUpdatedAt?.toISOString() ?? null) : null,
  };
}

export async function articleEditorData(id: string): Promise<EditorInitial | null> {
  const a = await prisma.article.findUnique({ where: { id }, include: { tags: { select: { name: true } }, previewImage: true } });
  if (!a) return null;
  const live: DraftFields = {
    title: a.title, description: a.excerpt, contentJson: (a.contentJson as JSONContent) ?? EMPTY_DOC, tags: a.tags.map((t) => t.name),
    publishedAt: a.publishedAt?.toISOString() ?? null, slug: a.slug, categoryId: a.categoryId, previewImageId: a.previewImageId,
    seoTitle: a.seoTitle ?? "", seoDescription: a.seoDescription ?? "",
  };
  const { fields, image } = await withDraft(live, a.draft);
  const previewImage = fields.previewImageId === a.previewImageId ? a.previewImage : image;
  return {
    id: a.id, title: fields.title, description: fields.description, contentJson: fields.contentJson, tags: fields.tags,
    status: a.status, publishedAt: fields.publishedAt, slug: fields.slug, categoryId: fields.categoryId,
    previewImage: previewImage ? toMediaItem(previewImage) : null, seoTitle: fields.seoTitle, seoDescription: fields.seoDescription,
    publicUrl: `/articles/${a.slug}`, pendingDraftAt: a.draft ? (a.draftUpdatedAt?.toISOString() ?? null) : null,
  };
}

export async function pageEditorData(key: string): Promise<EditorInitial> {
  const p = await prisma.page.findUnique({ where: { key } });
  const live: DraftFields = {
    title: p?.title ?? "About", description: "", contentJson: (p?.contentJson as JSONContent) ?? EMPTY_DOC, tags: [],
    publishedAt: null, slug: key, categoryId: null, previewImageId: null, seoTitle: "", seoDescription: "",
  };
  const { fields } = await withDraft(live, p?.draft);
  return {
    id: key, title: fields.title, description: "", contentJson: fields.contentJson, tags: [], status: "published", publishedAt: null,
    slug: key, categoryId: null, previewImage: null, seoTitle: "", seoDescription: "", publicUrl: `/${key}`,
    pendingDraftAt: p?.draft ? (p.draftUpdatedAt?.toISOString() ?? null) : null,
  };
}
