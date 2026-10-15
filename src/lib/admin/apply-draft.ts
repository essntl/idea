import type { JSONContent } from "@tiptap/core";
import type { ProjectPhase } from "../projects";

/**
 * The editor fields a pending draft can override. The editor's `description` is stored as `description` (blog),
 * `excerpt` (articles) or `summary` (projects).
 */
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
  projectId: string | null;
  phase: ProjectPhase;
  repoUrl: string;
  siteUrl: string;
  packageUrl: string;
  stack: string[];
  featured: boolean;
};

/** Defaults for fields a content type doesn't have. */
export const NO_EXTRA_FIELDS = {
  categoryId: null, previewImageId: null, seoTitle: "", seoDescription: "", projectId: null,
  phase: "building", repoUrl: "", siteUrl: "", packageUrl: "", stack: [], featured: false,
} satisfies Partial<DraftFields>;

type StoredDraft = Partial<{
  title: string; description: string; excerpt: string; summary: string; contentJson: JSONContent; tags: string[]; publishedAt: string | null;
  slug: string; categoryId: string | null; previewImageId: string | null; seoTitle: string | null; seoDescription: string | null;
  projectId: string | null; phase: ProjectPhase; repoUrl: string; siteUrl: string; packageUrl: string; stack: string[]; featured: boolean;
}>;

/** Overlays a stored draft on the live values. Fields missing from the draft keep their live value. */
export function applyDraft(live: DraftFields, draft: unknown): DraftFields {
  if (!draft || typeof draft !== "object") return live;
  const d = draft as StoredDraft;
  const has = (k: keyof StoredDraft) => Object.prototype.hasOwnProperty.call(d, k);
  const str = (k: "repoUrl" | "siteUrl" | "packageUrl") => (has(k) && typeof d[k] === "string" ? d[k] : live[k]);
  return {
    title: has("title") ? (d.title ?? "") : live.title,
    description: has("description") ? (d.description ?? "") : has("excerpt") ? (d.excerpt ?? "") : has("summary") ? (d.summary ?? "") : live.description,
    contentJson: d.contentJson && d.contentJson.type === "doc" ? d.contentJson : live.contentJson,
    tags: Array.isArray(d.tags) ? d.tags : live.tags,
    publishedAt: has("publishedAt") ? (d.publishedAt ?? null) : live.publishedAt,
    slug: has("slug") ? (d.slug ?? "") : live.slug,
    categoryId: has("categoryId") ? (d.categoryId ?? null) : live.categoryId,
    previewImageId: has("previewImageId") ? (d.previewImageId ?? null) : live.previewImageId,
    seoTitle: has("seoTitle") ? (d.seoTitle ?? "") : live.seoTitle,
    seoDescription: has("seoDescription") ? (d.seoDescription ?? "") : live.seoDescription,
    projectId: has("projectId") ? (d.projectId ?? null) : live.projectId,
    phase: has("phase") && d.phase ? d.phase : live.phase,
    repoUrl: str("repoUrl"),
    siteUrl: str("siteUrl"),
    packageUrl: str("packageUrl"),
    stack: Array.isArray(d.stack) ? d.stack : live.stack,
    featured: has("featured") ? !!d.featured : live.featured,
  };
}
