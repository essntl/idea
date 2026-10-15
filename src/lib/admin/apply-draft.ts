import type { JSONContent } from "@tiptap/core";

/** The editor fields a pending draft can override (blog uses `description`, articles store it as `excerpt`). */
export type DraftFields = {
  title: string;
  description: string;
  contentJson: JSONContent;
  tags: string[];
  publishedAt: string | null;
  slug: string;
  categoryId: string | null;
  previewImageId: string | null;
  seoTitle: string;
  seoDescription: string;
};

type StoredDraft = Partial<{
  title: string; description: string; excerpt: string; contentJson: JSONContent; tags: string[]; publishedAt: string | null;
  slug: string; categoryId: string | null; previewImageId: string | null; seoTitle: string | null; seoDescription: string | null;
}>;

/** Overlays a stored draft on the live values. Fields missing from the draft keep their live value. */
export function applyDraft(live: DraftFields, draft: unknown): DraftFields {
  if (!draft || typeof draft !== "object") return live;
  const d = draft as StoredDraft;
  const has = (k: keyof StoredDraft) => Object.prototype.hasOwnProperty.call(d, k);
  return {
    title: has("title") ? (d.title ?? "") : live.title,
    description: has("description") ? (d.description ?? "") : has("excerpt") ? (d.excerpt ?? "") : live.description,
    contentJson: d.contentJson && d.contentJson.type === "doc" ? d.contentJson : live.contentJson,
    tags: Array.isArray(d.tags) ? d.tags : live.tags,
    publishedAt: has("publishedAt") ? (d.publishedAt ?? null) : live.publishedAt,
    slug: has("slug") ? (d.slug ?? "") : live.slug,
    categoryId: has("categoryId") ? (d.categoryId ?? null) : live.categoryId,
    previewImageId: has("previewImageId") ? (d.previewImageId ?? null) : live.previewImageId,
    seoTitle: has("seoTitle") ? (d.seoTitle ?? "") : live.seoTitle,
    seoDescription: has("seoDescription") ? (d.seoDescription ?? "") : live.seoDescription,
  };
}
