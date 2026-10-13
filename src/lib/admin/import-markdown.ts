import path from "node:path";
import { prisma } from "../db";
import { parseMarkdown, isRemoteUrl } from "../markdown";
import { slugify } from "../slug";
import { createArticleDraft, createBlogDraft } from "./content";
import { importRemoteImage, toMediaItem } from "./media-service";

export type ImportResult = {
  filename: string;
  id: string;
  type: "blog" | "article";
  title: string;
  unresolvedImages: string[];
  warnings: string[];
};

/** Matches local image references to media library items by file name. */
async function mediaResolver() {
  const media = await prisma.media.findMany({ select: { path: true, filename: true } });
  const byName = new Map<string, string>();
  for (const m of media) {
    const name = m.filename.toLowerCase();
    byName.set(name, `/media/${m.path}`);
    byName.set(name.replace(/\.[^.]+$/, ""), `/media/${m.path}`);
  }
  return (ref: string) => {
    const base = path.posix.basename(ref.split(/[?#]/)[0]!).toLowerCase();
    return byName.get(base) ?? byName.get(base.replace(/\.[^.]+$/, "")) ?? null;
  };
}

async function findOrCreateCategory(name: string) {
  const slug = slugify(name);
  const cat =
    (await prisma.category.findFirst({ where: { OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }] } })) ??
    (await prisma.category.create({ data: { name, slug: slug || `category-${Date.now()}` } }));
  return cat.id;
}

/** Resolves the front matter `image` to a media item (downloading remote URLs). */
async function resolvePreviewImage(image: string, resolve: (ref: string) => string | null, warnings: string[]) {
  if (isRemoteUrl(image)) {
    try {
      return (await importRemoteImage(image)).media;
    } catch (err) {
      warnings.push(`Could not download preview image: ${(err as Error).message}`);
      return null;
    }
  }
  const url = resolve(image);
  return url ? prisma.media.findUnique({ where: { path: url.replace(/^\/media\//, "") } }) : null;
}

/** Parses a markdown file for the open editor without creating anything (except a missing category). */
export async function parseMarkdownForEditor(type: "blog" | "article", source: string) {
  const resolve = await mediaResolver();
  const parsed = parseMarkdown(source, resolve);
  const fm = parsed.frontMatter;
  const warnings: string[] = [];
  const unresolved = [...parsed.unresolvedImages];
  let previewImage = null;
  let categoryId: string | null = null;
  if (type === "article") {
    if (fm.category) categoryId = await findOrCreateCategory(fm.category);
    if (fm.image) {
      previewImage = await resolvePreviewImage(fm.image, resolve, warnings);
      if (!previewImage && !isRemoteUrl(fm.image)) unresolved.push(fm.image);
    }
  }
  return { title: parsed.title, frontMatter: fm, doc: parsed.doc, unresolvedImages: unresolved, warnings, categoryId, previewImage: previewImage ? toMediaItem(previewImage) : null };
}

/** Creates a draft from a markdown file. */
export async function importMarkdownFile(type: "blog" | "article", filename: string, source: string): Promise<ImportResult> {
  const resolve = await mediaResolver();

  const parsed = parseMarkdown(source, resolve);
  const fm = parsed.frontMatter;
  const title = parsed.title || filename.replace(/\.(md|markdown)$/i, "");
  const warnings: string[] = [];
  const unresolved = [...parsed.unresolvedImages];

  if (type === "blog") {
    const post = await createBlogDraft({ title, description: fm.description ?? "", contentJson: parsed.doc, tags: fm.tags, publishedAt: fm.date ?? null });
    if (fm.image) warnings.push("Blog posts have no preview image; front matter `image` was ignored.");
    return { filename, id: post.id, type, title, unresolvedImages: unresolved, warnings };
  }

  const categoryId = fm.category ? await findOrCreateCategory(fm.category) : null;
  let previewImageId: string | null = null;
  if (fm.image) {
    const m = await resolvePreviewImage(fm.image, resolve, warnings);
    if (m) previewImageId = m.id;
    else if (!isRemoteUrl(fm.image)) unresolved.push(fm.image);
  }

  const article = await createArticleDraft({
    title,
    slug: fm.slug,
    excerpt: fm.description ?? "",
    contentJson: parsed.doc,
    tags: fm.tags,
    publishedAt: fm.date ?? null,
    categoryId,
    previewImageId,
  });
  if (fm.slug && article.slug !== fm.slug) warnings.push(`Slug "${fm.slug}" was taken or invalid; using "${article.slug}".`);
  return { filename, id: article.id, type, title, unresolvedImages: unresolved, warnings };
}
