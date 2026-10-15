import type { JSONContent } from "@tiptap/core";
import { prisma } from "../db";
import { toMediaItem } from "./media-service";
import type { EditorInitial } from "@/components/admin/post-editor";
import { EMPTY_DOC } from "../content/extensions";
import { applyDraft, NO_EXTRA_FIELDS, type DraftFields } from "./apply-draft";

export async function tagSuggestions() {
  return (await prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } })).map((t) => t.name);
}

/** Technologies already used on other projects, for the stack input. */
export async function stackSuggestions() {
  const rows = await prisma.project.findMany({ select: { stack: true } });
  return [...new Set(rows.flatMap((r) => r.stack))].sort((a, b) => a.localeCompare(b));
}

/** Projects a post can be linked to (as a progress update). */
export async function projectOptions() {
  return prisma.project.findMany({ orderBy: [{ status: "desc" }, { title: "asc" }], select: { id: true, title: true } });
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

function initial(
  id: string,
  status: EditorInitial["status"],
  fields: DraftFields,
  previewImage: EditorInitial["previewImage"],
  extra: Pick<EditorInitial, "publicUrl" | "pendingDraftAt">,
): EditorInitial {
  const { previewImageId: _omit, ...rest } = fields;
  void _omit;
  return { id, status, ...rest, previewImage, ...extra };
}

const pending = (draft: unknown, at: Date | null) => (draft ? (at?.toISOString() ?? null) : null);

export async function blogEditorData(id: string): Promise<EditorInitial | null> {
  const p = await prisma.blogPost.findUnique({ where: { id }, include: { tags: { select: { name: true } } } });
  if (!p) return null;
  const live: DraftFields = {
    ...NO_EXTRA_FIELDS,
    title: p.title, description: p.description, contentJson: (p.contentJson as JSONContent) ?? EMPTY_DOC, tags: p.tags.map((t) => t.name),
    publishedAt: p.publishedAt?.toISOString() ?? null, slug: p.slug, projectId: p.projectId,
  };
  const { fields } = await withDraft(live, p.draft);
  return initial(p.id, p.status, { ...fields, slug: p.slug }, null, { publicUrl: `/blog/${p.slug}`, pendingDraftAt: pending(p.draft, p.draftUpdatedAt) });
}

export async function articleEditorData(id: string): Promise<EditorInitial | null> {
  const a = await prisma.article.findUnique({ where: { id }, include: { tags: { select: { name: true } }, previewImage: true } });
  if (!a) return null;
  const live: DraftFields = {
    ...NO_EXTRA_FIELDS,
    title: a.title, description: a.excerpt, contentJson: (a.contentJson as JSONContent) ?? EMPTY_DOC, tags: a.tags.map((t) => t.name),
    publishedAt: a.publishedAt?.toISOString() ?? null, slug: a.slug, categoryId: a.categoryId, previewImageId: a.previewImageId,
    seoTitle: a.seoTitle ?? "", seoDescription: a.seoDescription ?? "", projectId: a.projectId,
  };
  const { fields, image } = await withDraft(live, a.draft);
  const previewImage = fields.previewImageId === a.previewImageId ? a.previewImage : image;
  return initial(a.id, a.status, fields, previewImage ? toMediaItem(previewImage) : null, {
    publicUrl: `/articles/${a.slug}`, pendingDraftAt: pending(a.draft, a.draftUpdatedAt),
  });
}

export async function projectEditorData(id: string): Promise<EditorInitial | null> {
  const p = await prisma.project.findUnique({ where: { id }, include: { previewImage: true } });
  if (!p) return null;
  const live: DraftFields = {
    ...NO_EXTRA_FIELDS,
    title: p.title, description: p.summary, contentJson: (p.contentJson as JSONContent) ?? EMPTY_DOC, tags: [],
    publishedAt: p.publishedAt?.toISOString() ?? null, slug: p.slug, previewImageId: p.previewImageId,
    phase: p.phase, repoUrl: p.repoUrl ?? "", siteUrl: p.siteUrl ?? "", packageUrl: p.packageUrl ?? "", stack: p.stack, featured: p.featured,
  };
  const { fields, image } = await withDraft(live, p.draft);
  const previewImage = fields.previewImageId === p.previewImageId ? p.previewImage : image;
  return initial(p.id, p.status, fields, previewImage ? toMediaItem(previewImage) : null, {
    publicUrl: `/projects/${p.slug}`, pendingDraftAt: pending(p.draft, p.draftUpdatedAt),
  });
}

export async function pageEditorData(key: string): Promise<EditorInitial> {
  const p = await prisma.page.findUnique({ where: { key } });
  const live: DraftFields = {
    ...NO_EXTRA_FIELDS,
    title: p?.title ?? "About", description: "", contentJson: (p?.contentJson as JSONContent) ?? EMPTY_DOC, tags: [], publishedAt: null, slug: key,
  };
  const { fields } = await withDraft(live, p?.draft);
  return initial(key, "published", { ...fields, description: "", tags: [] }, null, { publicUrl: `/${key}`, pendingDraftAt: pending(p?.draft, p?.draftUpdatedAt ?? null) });
}
