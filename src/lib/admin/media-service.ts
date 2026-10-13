import sharp from "sharp";
import { prisma } from "../db";
import { storeImage, deleteStoredImage, resolveMediaPath, maxUploadBytes, MediaError } from "../media";
import { readFile } from "node:fs/promises";

export type MediaItem = {
  id: string; url: string; path: string; filename: string; width: number; height: number;
  size: number; alt: string; mimeType: string; createdAt: string;
};

export function toMediaItem(m: { id: string; path: string; filename: string; width: number; height: number; size: number; alt: string; mimeType: string; createdAt: Date }): MediaItem {
  return { ...m, url: `/media/${m.path}`, createdAt: m.createdAt.toISOString() };
}

function cleanFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, "").trim().slice(0, 200) || "image";
}

export async function createMedia(buffer: Buffer, filename: string, alt = "", sourceUrl?: string) {
  const stored = await storeImage(buffer);
  const media = await prisma.media.create({
    data: { ...stored, filename: cleanFilename(filename), alt: alt.slice(0, 500), sourceUrl: sourceUrl ?? null },
  });
  return media;
}

/** Downloads a remote image into the library (deduplicated by source URL). */
export async function importRemoteImage(url: string, alt = "") {
  const existing = await prisma.media.findUnique({ where: { sourceUrl: url } });
  if (existing) return { media: existing, downloaded: false };
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "user-agent": "Mozilla/5.0 (compatible; blog-importer/1.0)" } });
  if (!res.ok) throw new MediaError(`HTTP ${res.status} for ${url}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxUploadBytes()) throw new MediaError(`Image too large: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "image");
  const media = await createMedia(buf, name, alt, url);
  return { media, downloaded: true };
}

export async function mediaUsage(id: string) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return null;
  const needle = `/media/${media.path}`;
  const [previews, articles, posts, pages] = await Promise.all([
    prisma.article.findMany({ where: { previewImageId: id }, select: { id: true, title: true } }),
    prisma.article.findMany({ where: { contentHtml: { contains: needle } }, select: { id: true, title: true } }),
    prisma.blogPost.findMany({ where: { contentHtml: { contains: needle } }, select: { id: true, title: true } }),
    prisma.page.findMany({ where: { contentHtml: { contains: needle } }, select: { key: true, title: true } }),
  ]);
  return [
    ...previews.map((a) => ({ kind: "article preview", id: a.id, title: a.title || "Untitled", href: `/admin/articles/${a.id}` })),
    ...articles.map((a) => ({ kind: "article", id: a.id, title: a.title || "Untitled", href: `/admin/articles/${a.id}` })),
    ...posts.map((p) => ({ kind: "blog post", id: p.id, title: p.title || "Untitled", href: `/admin/blog/${p.id}` })),
    ...pages.map((p) => ({ kind: "page", id: p.key, title: p.title || p.key, href: `/admin/about` })),
  ];
}

export async function deleteMedia(id: string) {
  const media = await prisma.media.delete({ where: { id } });
  await deleteStoredImage(media.path);
}

/** Crops (fractions of the image) into a new media item, leaving the original untouched. */
export async function cropMedia(id: string, crop: { x: number; y: number; width: number; height: number }) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new MediaError("Image not found");
  const abs = resolveMediaPath(media.path.split("/"));
  if (!abs) throw new MediaError("Image not found");
  const input = await readFile(abs);
  const left = Math.round(crop.x * media.width);
  const top = Math.round(crop.y * media.height);
  const width = Math.min(media.width - left, Math.round(crop.width * media.width));
  const height = Math.min(media.height - top, Math.round(crop.height * media.height));
  if (width < 10 || height < 10) throw new MediaError("Crop area is too small");
  const cropped = await sharp(input).extract({ left, top, width, height }).toBuffer();
  return createMedia(cropped, media.filename.replace(/(\.\w+)?$/, "-crop$1"), media.alt);
}
