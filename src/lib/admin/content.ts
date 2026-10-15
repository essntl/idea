import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import { prisma } from "../db";
import { renderDocument } from "../content/pipeline";
import { EMPTY_DOC } from "../content/extensions";
import { slugify, uniqueSlug, validateSlug } from "../slug";
import { HttpError } from "../errors";
import { PROJECT_PHASES } from "../projects";
import { Prisma } from "@/generated/prisma/client";

/* ------------------------------- validation ------------------------------ */

const MAX_DOC_BYTES = 5 * 1024 * 1024;

export const docSchema = z
  .custom<JSONContent>((v) => typeof v === "object" && v !== null && (v as JSONContent).type === "doc", "Invalid document")
  .refine((v) => JSON.stringify(v).length <= MAX_DOC_BYTES, "Document is too large");

const tagNames = z.array(z.string().trim().min(1).max(50)).max(30);
const isoDate = z.string().datetime({ offset: true }).nullable();

const projectRef = z.string().max(40).nullable().optional();

export const blogInputSchema = z.object({
  title: z.string().trim().max(200),
  description: z.string().trim().max(500).default(""),
  contentJson: docSchema,
  tags: tagNames.default([]),
  status: z.enum(["draft", "published"]),
  publishedAt: isoDate.optional(),
  projectId: projectRef,
});

export const articleInputSchema = z.object({
  title: z.string().trim().max(200),
  slug: z.string().trim().max(120),
  excerpt: z.string().trim().max(1000).default(""),
  contentJson: docSchema,
  tags: tagNames.default([]),
  status: z.enum(["draft", "published", "scheduled"]),
  publishedAt: isoDate.optional(),
  categoryId: z.string().max(40).nullable().optional(),
  previewImageId: z.string().max(40).nullable().optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(400).nullable().optional(),
  projectId: projectRef,
});

/** Links are checked on save (normalizeUrl), so a half-typed URL can still autosave as a pending draft. */
const linkField = z.string().trim().max(500).default("");

export const projectInputSchema = z.object({
  title: z.string().trim().max(200),
  slug: z.string().trim().max(120),
  summary: z.string().trim().max(500).default(""),
  contentJson: docSchema,
  status: z.enum(["draft", "published"]),
  publishedAt: isoDate.optional(),
  phase: z.enum(PROJECT_PHASES),
  repoUrl: linkField,
  siteUrl: linkField,
  packageUrl: linkField,
  stack: tagNames.default([]),
  featured: z.boolean().default(false),
  previewImageId: z.string().max(40).nullable().optional(),
});

export type BlogInput = z.infer<typeof blogInputSchema>;
export type ArticleInput = z.infer<typeof articleInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;

/* --------------------------------- helpers -------------------------------- */

/** Upserts tags by name, returning `connect` targets. */
export async function resolveTags(names: string[]) {
  const unique = [...new Map(names.map((n) => [slugify(n) || n.toLowerCase(), n])).entries()].filter(([slug]) => slug);
  const tags = await Promise.all(
    unique.map(async ([slug, name]) => {
      const existing = await prisma.tag.findFirst({ where: { OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }] } });
      return existing ?? prisma.tag.create({ data: { name, slug } });
    }),
  );
  return tags.map((t) => ({ id: t.id }));
}

/**
 * Publish date rules: published without a date → now; scheduled requires a date; drafts keep whatever was set
 * (so backdating survives unpublishing).
 */
export function resolvePublishedAt(status: string, requested: string | null | undefined, current: Date | null): Date | null {
  const date = requested ? new Date(requested) : requested === null ? null : current;
  if (status === "published") return date ?? new Date();
  if (status === "scheduled") {
    if (!date) throw new HttpError(400, "Scheduled articles need a publish date");
    return date;
  }
  return date;
}

async function blogSlug(title: string, date: Date, id?: string) {
  const day = date.toISOString().slice(0, 10);
  const base = `${day}-${slugify(title) || "post"}`.slice(0, 100);
  return uniqueSlug(base, async (s) => !!(await prisma.blogPost.findFirst({ where: { slug: s, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })));
}

export async function isArticleSlugTaken(slug: string, excludeId?: string) {
  const hit = await prisma.article.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  return !!hit;
}

export async function isProjectSlugTaken(slug: string, excludeId?: string) {
  const hit = await prisma.project.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  return !!hit;
}

/** `projectId` is optional in the input: undefined leaves the link alone, null removes it. */
async function projectLink(projectId: string | null | undefined) {
  if (projectId === undefined) return {};
  if (projectId && !(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) throw new HttpError(400, "Unknown project");
  return { projectId: projectId || null };
}

/** "github.com/x" → "https://github.com/x"; "" → null; anything that isn't an http(s) URL is rejected. */
export function normalizeUrl(value: string, label: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new HttpError(400, `${label} is not a valid URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new HttpError(400, `${label} must be an http(s) link`);
  const s = url.toString();
  return url.pathname === "/" && !url.search && !url.hash ? s.replace(/\/$/, "") : s;
}

/* ---------------------------------- blog ---------------------------------- */

export async function createBlogDraft(init?: Partial<BlogInput>) {
  const title = init?.title ?? "";
  const doc = init?.contentJson ?? EMPTY_DOC;
  const rendered = await renderDocument(doc);
  const tags = init?.tags?.length ? await resolveTags(init.tags) : [];
  const publishedAt = init?.publishedAt ? new Date(init.publishedAt) : null;
  return prisma.blogPost.create({
    data: {
      title,
      description: init?.description ?? "",
      slug: await blogSlug(title || "untitled", publishedAt ?? new Date()),
      contentJson: doc as object,
      contentHtml: rendered.html,
      contentText: rendered.text,
      status: "draft",
      publishedAt,
      tags: { connect: tags },
    },
  });
}

export async function updateBlogPost(id: string, raw: unknown) {
  const input = blogInputSchema.parse(raw);
  const current = await prisma.blogPost.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Post not found");
  if (input.status !== "draft" && !input.title) throw new HttpError(400, "A title is required to publish");
  const publishedAt = resolvePublishedAt(input.status, input.publishedAt, current.publishedAt);
  const rendered = await renderDocument(input.contentJson);
  // The URL is derived from date + title until the post is first published, then frozen.
  const wasPublished = current.status === "published";
  const slug = wasPublished ? current.slug : await blogSlug(input.title || "untitled", publishedAt ?? current.createdAt, id);
  return prisma.blogPost.update({
    where: { id },
    data: {
      ...CLEAR_DRAFT,
      title: input.title,
      description: input.description,
      slug,
      contentJson: input.contentJson as object,
      contentHtml: rendered.html,
      contentText: rendered.text,
      status: input.status,
      publishedAt,
      ...(await projectLink(input.projectId)),
      tags: { set: await resolveTags(input.tags) },
    },
    include: { tags: true },
  });
}

/* -------------------------------- articles -------------------------------- */

export async function createArticleDraft(init?: Partial<ArticleInput> & { legacyUrl?: string }) {
  const title = init?.title ?? "";
  const doc = init?.contentJson ?? EMPTY_DOC;
  const rendered = await renderDocument(doc);
  const requested = init?.slug && !validateSlug(init.slug) ? init.slug : title || "untitled";
  const slug = await uniqueSlug(requested, (s) => isArticleSlugTaken(s));
  const tags = init?.tags?.length ? await resolveTags(init.tags) : [];
  return prisma.article.create({
    data: {
      title,
      slug,
      excerpt: init?.excerpt ?? "",
      contentJson: doc as object,
      contentHtml: rendered.html,
      contentText: rendered.text,
      toc: rendered.toc,
      readingTime: rendered.readingTime,
      status: "draft",
      publishedAt: init?.publishedAt ? new Date(init.publishedAt) : null,
      categoryId: init?.categoryId ?? null,
      previewImageId: init?.previewImageId ?? null,
      tags: { connect: tags },
    },
  });
}

export async function updateArticle(id: string, raw: unknown) {
  const input = articleInputSchema.parse(raw);
  const current = await prisma.article.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Article not found");
  if (input.status !== "draft" && !input.title) throw new HttpError(400, "A title is required to publish");
  const slugError = validateSlug(input.slug);
  if (slugError) throw new HttpError(400, `Slug: ${slugError}`);
  if (await isArticleSlugTaken(input.slug, id)) throw new HttpError(409, "Slug is already used by another article");
  if (input.categoryId && !(await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
    throw new HttpError(400, "Unknown category");
  }
  if (input.previewImageId && !(await prisma.media.findUnique({ where: { id: input.previewImageId }, select: { id: true } }))) {
    throw new HttpError(400, "Unknown preview image");
  }
  const publishedAt = resolvePublishedAt(input.status, input.publishedAt, current.publishedAt);
  const rendered = await renderDocument(input.contentJson);

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...CLEAR_DRAFT,
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      contentJson: input.contentJson as object,
      contentHtml: rendered.html,
      contentText: rendered.text,
      toc: rendered.toc,
      readingTime: rendered.readingTime,
      status: input.status,
      publishedAt,
      categoryId: input.categoryId ?? null,
      previewImageId: input.previewImageId ?? null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      ...(await projectLink(input.projectId)),
      tags: { set: await resolveTags(input.tags) },
    },
    include: { tags: true },
  });

  // Keep old links working when a published article's slug changes.
  if (current.slug !== input.slug && current.publishedAt) {
    await upsertRedirect(`/articles/${current.slug}`, `/articles/${input.slug}`);
    await prisma.redirect.updateMany({ where: { toPath: `/articles/${current.slug}` }, data: { toPath: `/articles/${input.slug}` } });
  }
  await prisma.redirect.deleteMany({ where: { fromPath: `/articles/${input.slug}` } });
  return article;
}

export async function upsertRedirect(fromPath: string, toPath: string, statusCode = 301) {
  if (fromPath === toPath) return;
  await prisma.redirect.upsert({ where: { fromPath }, create: { fromPath, toPath, statusCode }, update: { toPath, statusCode } });
}

/* -------------------------------- projects -------------------------------- */

export async function createProjectDraft() {
  const rendered = await renderDocument(EMPTY_DOC);
  return prisma.project.create({
    data: {
      title: "",
      slug: await uniqueSlug("untitled", (s) => isProjectSlugTaken(s)),
      contentJson: EMPTY_DOC as object,
      contentHtml: rendered.html,
      contentText: rendered.text,
    },
  });
}

export async function updateProject(id: string, raw: unknown) {
  const input = projectInputSchema.parse(raw);
  const current = await prisma.project.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Project not found");
  if (input.status !== "draft" && !input.title) throw new HttpError(400, "A title is required to publish");
  const slugError = validateSlug(input.slug);
  if (slugError) throw new HttpError(400, `Slug: ${slugError}`);
  if (await isProjectSlugTaken(input.slug, id)) throw new HttpError(409, "Slug is already used by another project");
  if (input.previewImageId && !(await prisma.media.findUnique({ where: { id: input.previewImageId }, select: { id: true } }))) {
    throw new HttpError(400, "Unknown cover image");
  }
  const links = {
    repoUrl: normalizeUrl(input.repoUrl, "Repository link"),
    siteUrl: normalizeUrl(input.siteUrl, "Website link"),
    packageUrl: normalizeUrl(input.packageUrl, "Package link"),
  };
  const publishedAt = resolvePublishedAt(input.status, input.publishedAt, current.publishedAt);
  const rendered = await renderDocument(input.contentJson);
  const stack = [...new Map(input.stack.map((t) => [t.toLowerCase(), t])).values()];

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...CLEAR_DRAFT,
      ...links,
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      contentJson: input.contentJson as object,
      contentHtml: rendered.html,
      contentText: rendered.text,
      status: input.status,
      publishedAt,
      phase: input.phase,
      stack,
      featured: input.featured,
      previewImageId: input.previewImageId ?? null,
    },
  });

  // Keep old links working when a published project's slug changes.
  if (current.slug !== input.slug && current.publishedAt) {
    await upsertRedirect(`/projects/${current.slug}`, `/projects/${input.slug}`);
    await prisma.redirect.updateMany({ where: { toPath: `/projects/${current.slug}` }, data: { toPath: `/projects/${input.slug}` } });
  }
  await prisma.redirect.deleteMany({ where: { fromPath: `/projects/${input.slug}` } });
  return project;
}

/* ----------------------------- pending changes ----------------------------- */

/**
 * Edits to live content are autosaved here instead of the published fields, so visitors keep seeing
 * the live version until "Publish changes". Drafts are validated loosely (a half-written title or slug is fine).
 */
export const draftSchemas = {
  blog: blogInputSchema.omit({ status: true }),
  article: articleInputSchema.omit({ status: true }),
  project: projectInputSchema.omit({ status: true }),
  page: z.object({ title: z.string().trim().max(200), contentJson: docSchema }),
} as const;

export type DraftKind = keyof typeof draftSchemas;

export const CLEAR_DRAFT = { draft: Prisma.DbNull, draftUpdatedAt: null };

export async function savePendingDraft(kind: DraftKind, id: string, raw: unknown) {
  const draft = draftSchemas[kind].parse(raw) as object;
  const data = { draft, draftUpdatedAt: new Date() };
  try {
    if (kind === "blog") return await prisma.blogPost.update({ where: { id }, data, select: { draftUpdatedAt: true } });
    if (kind === "article") return await prisma.article.update({ where: { id }, data, select: { draftUpdatedAt: true } });
    if (kind === "project") return await prisma.project.update({ where: { id }, data, select: { draftUpdatedAt: true } });
    return await prisma.page.update({ where: { key: id }, data, select: { draftUpdatedAt: true } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") throw new HttpError(404, "Not found");
    throw err;
  }
}

export async function discardPendingDraft(kind: DraftKind, id: string) {
  if (kind === "blog") await prisma.blogPost.updateMany({ where: { id }, data: CLEAR_DRAFT });
  else if (kind === "article") await prisma.article.updateMany({ where: { id }, data: CLEAR_DRAFT });
  else if (kind === "project") await prisma.project.updateMany({ where: { id }, data: CLEAR_DRAFT });
  else await prisma.page.updateMany({ where: { key: id }, data: CLEAR_DRAFT });
}

/* ---------------------------------- pages --------------------------------- */

export const pageInputSchema = z.object({ title: z.string().trim().max(200), contentJson: docSchema });

export async function savePage(key: string, raw: unknown) {
  const input = pageInputSchema.parse(raw);
  const rendered = await renderDocument(input.contentJson);
  return prisma.page.upsert({
    where: { key },
    create: { key, title: input.title, contentJson: input.contentJson as object, contentHtml: rendered.html },
    update: { ...CLEAR_DRAFT, title: input.title, contentJson: input.contentJson as object, contentHtml: rendered.html },
  });
}

/** Effective status for admin lists ("scheduled" whose time passed is live). */
export function effectiveStatus(status: string, publishedAt: Date | null): "draft" | "published" | "scheduled" {
  if (status === "draft") return "draft";
  if (publishedAt && publishedAt > new Date()) return "scheduled";
  return "published";
}
