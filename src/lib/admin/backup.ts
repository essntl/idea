/**
 * Backup = gzip'd tar containing `backup.json` (all content tables except users) and `media/<path>` files.
 * Restore replaces all content in a single transaction, then writes media files.
 */
import { createGzip, createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import tar from "tar-stream";
import { z } from "zod";
import { prisma } from "../db";
import { resolveMediaPath } from "../media";
import { Prisma } from "@/generated/prisma/client";

export const BACKUP_VERSION = 1;

export async function createBackupStream(): Promise<Readable> {
  const [categories, tags, media, blogPosts, articles, comments, pages, settings, redirects] = await Promise.all([
    prisma.category.findMany(),
    prisma.tag.findMany(),
    prisma.media.findMany(),
    prisma.blogPost.findMany({ include: { tags: { select: { id: true } } } }),
    prisma.article.findMany({ include: { tags: { select: { id: true } } } }),
    prisma.comment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.page.findMany(),
    prisma.setting.findMany(),
    prisma.redirect.findMany(),
  ]);
  const data = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories, tags, media,
    blogPosts: blogPosts.map(({ tags: t, ...p }) => ({ ...p, tagIds: t.map((x) => x.id) })),
    articles: articles.map(({ tags: t, ...a }) => ({ ...a, tagIds: t.map((x) => x.id) })),
    comments, pages, settings, redirects,
  };

  const pack = tar.pack();
  (async () => {
    try {
      pack.entry({ name: "backup.json" }, JSON.stringify(data, null, 1));
      for (const m of media) {
        const abs = resolveMediaPath(m.path.split("/"));
        if (!abs) continue;
        try {
          const buf = await readFile(abs);
          await new Promise<void>((res, rej) => pack.entry({ name: `media/${m.path}`, size: buf.byteLength }, buf, (err) => (err ? rej(err) : res())));
        } catch {
          // Missing file: skip, the DB row is still exported.
        }
      }
      pack.finalize();
    } catch (err) {
      pack.destroy(err as Error);
    }
  })();
  return pack.pipe(createGzip());
}

const date = z.coerce.date();
const nDate = date.nullable();
const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  categories: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string(), description: z.string() })),
  tags: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
  media: z.array(z.object({
    id: z.string(), filename: z.string(), path: z.string(), width: z.number(), height: z.number(), mimeType: z.string(),
    size: z.number(), alt: z.string(), sourceUrl: z.string().nullable(), createdAt: date,
  })),
  blogPosts: z.array(z.object({
    id: z.string(), slug: z.string(), title: z.string(), description: z.string(), contentJson: z.any(), contentHtml: z.string(),
    contentText: z.string(), status: z.enum(["draft", "published", "scheduled"]), publishedAt: nDate, createdAt: date, updatedAt: date,
    draft: z.any().optional(), draftUpdatedAt: nDate.optional(),
    tagIds: z.array(z.string()),
  })),
  articles: z.array(z.object({
    id: z.string(), title: z.string(), slug: z.string(), excerpt: z.string(), contentJson: z.any(), contentHtml: z.string(),
    contentText: z.string(), toc: z.any(), previewImageId: z.string().nullable(), categoryId: z.string().nullable(),
    status: z.enum(["draft", "published", "scheduled"]), publishedAt: nDate, createdAt: date, updatedAt: date,
    seoTitle: z.string().nullable(), seoDescription: z.string().nullable(), readingTime: z.number(), legacyUrl: z.string().nullable(),
    draft: z.any().optional(), draftUpdatedAt: nDate.optional(),
    tagIds: z.array(z.string()),
  })),
  comments: z.array(z.object({
    id: z.string(), articleId: z.string().nullable(), blogPostId: z.string().nullable().default(null), parentId: z.string().nullable(), authorName: z.string(), authorEmail: z.string().nullable(),
    body: z.string(), isAdminReply: z.boolean(), status: z.enum(["visible", "pending", "hidden", "deleted"]), ipHash: z.string().nullable(),
    createdAt: date,
  })),
  pages: z.array(z.object({ id: z.string(), key: z.string(), title: z.string(), contentJson: z.any(), contentHtml: z.string(), updatedAt: date, draft: z.any().optional(), draftUpdatedAt: nDate.optional() })),
  settings: z.array(z.object({ key: z.string(), value: z.any() })),
  redirects: z.array(z.object({ id: z.string(), fromPath: z.string(), toPath: z.string(), statusCode: z.number(), createdAt: date })),
});

export type RestoreSummary = { posts: number; articles: number; comments: number; media: number; files: number };

/** Restores from a .tar.gz stream. Media files are written as they arrive; the DB is replaced at the end. */
export async function restoreBackup(input: Readable): Promise<RestoreSummary> {
  const extract = tar.extract();
  let json: string | null = null;
  let files = 0;
  extract.on("entry", (header, stream, next) => {
    const name = header.name.replace(/^\.\//, "");
    if (header.type === "file" && name === "backup.json") {
      const chunks: Buffer[] = [];
      stream.on("data", (c) => void chunks.push(c as Buffer));
      stream.on("end", () => {
        json = Buffer.concat(chunks).toString("utf8");
        next();
      });
      return;
    }
    const segs = name.startsWith("media/") ? name.slice(6).split("/") : null;
    const abs = header.type === "file" && segs ? resolveMediaPath(segs) : null;
    if (abs && abs.endsWith(".webp")) {
      mkdir(path.dirname(abs), { recursive: true })
        .then(() => pipeline(stream, createWriteStream(abs)))
        .then(() => {
          files++;
          next();
        })
        .catch(next);
      return;
    }
    stream.resume();
    stream.on("end", next);
  });
  await pipeline(input, createGunzip(), extract);
  if (!json) throw new Error("backup.json not found in archive");
  const data = backupSchema.parse(JSON.parse(json));

  await prisma.$transaction(
    async (tx) => {
      await tx.comment.deleteMany();
      await tx.article.deleteMany();
      await tx.blogPost.deleteMany();
      await tx.tag.deleteMany();
      await tx.category.deleteMany();
      await tx.media.deleteMany();
      await tx.page.deleteMany();
      await tx.setting.deleteMany();
      await tx.redirect.deleteMany();

      await tx.category.createMany({ data: data.categories });
      await tx.tag.createMany({ data: data.tags });
      await tx.media.createMany({ data: data.media });
      for (const { tagIds, ...p } of data.blogPosts) {
        await tx.blogPost.create({ data: { ...p, draft: p.draft ?? Prisma.DbNull, contentJson: p.contentJson ?? {}, tags: { connect: tagIds.map((id) => ({ id })) } } });
      }
      for (const { tagIds, ...a } of data.articles) {
        await tx.article.create({ data: { ...a, draft: a.draft ?? Prisma.DbNull, contentJson: a.contentJson ?? {}, toc: a.toc ?? [], tags: { connect: tagIds.map((id) => ({ id })) } } });
      }
      // Parents before replies (sorted by createdAt on export).
      for (const c of data.comments) await tx.comment.create({ data: c });
      for (const p of data.pages) await tx.page.create({ data: { ...p, draft: p.draft ?? Prisma.DbNull, contentJson: p.contentJson ?? {} } });
      for (const s of data.settings) await tx.setting.create({ data: { key: s.key, value: s.value ?? null } });
      await tx.redirect.createMany({ data: data.redirects });
    },
    { timeout: 120_000 },
  );
  return { posts: data.blogPosts.length, articles: data.articles.length, comments: data.comments.length, media: data.media.length, files };
}
