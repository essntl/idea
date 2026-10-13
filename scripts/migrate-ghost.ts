/**
 * Ghost → Articles migration.
 *
 *   npm run migrate:ghost -- --file ./ghost-export.json            # preferred: Ghost Admin export
 *   npm run migrate:ghost -- --scrape                              # fallback: scrape https://artyomtechtips.com
 *   npm run migrate:ghost -- --scrape https://example.com --limit 3 --dry-run
 *
 * Options:
 *   --site-url <url>        Old site URL (default https://artyomtechtips.com); used to resolve relative/__GHOST_URL__ links
 *   --tags <mode>           first-as-category (default) | all-tags
 *   --download-external     Also download hot-linked images from other hosts (default: keep them remote)
 *   --update                Re-import posts whose slug already exists (default: skip them)
 *   --limit <n>             Only process the first n posts
 *   --dry-run               Parse and report, but write nothing
 *
 * Re-runnable: posts are matched on slug, images on their source URL, redirects on their path.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { htmlToDoc } from "../src/lib/content/html-to-doc";
import { renderDocument } from "../src/lib/content/pipeline";
import { slugify, RESERVED_SLUGS } from "../src/lib/slug";
import { resolveTags, upsertRedirect } from "../src/lib/admin/content";
import { importRemoteImage } from "../src/lib/admin/media-service";
import {
  convertGhostHtml, isOwnImage, mapTags, parseGhostExport, parseGhostPage, parseRss, parseSitemap, rewriteImages,
  normalizeSiteUrl, type GhostPost,
} from "../src/lib/ghost/parse";

type Options = {
  file?: string; scrape?: string; siteUrl: string; tags: "first-as-category" | "all-tags";
  downloadExternal: boolean; update: boolean; limit?: number; dryRun: boolean;
};

function parseArgs(argv: string[]): Options {
  const opts: Options = { siteUrl: "https://artyomtechtips.com", tags: "first-as-category", downloadExternal: false, update: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => {
      const v = argv[i + 1];
      if (!v || v.startsWith("--")) return undefined;
      i++;
      return v;
    };
    if (a === "--file") opts.file = next();
    else if (a === "--scrape") opts.scrape = next() ?? "";
    else if (a === "--site-url") opts.siteUrl = next() ?? opts.siteUrl;
    else if (a === "--tags") opts.tags = next() === "all-tags" ? "all-tags" : "first-as-category";
    else if (a === "--download-external") opts.downloadExternal = true;
    else if (a === "--update") opts.update = true;
    else if (a === "--limit") opts.limit = Number(next());
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--help" || a === "-h") {
      console.log(readHelp());
      process.exit(0);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  if (opts.scrape !== undefined) opts.siteUrl = normalizeSiteUrl(opts.scrape || opts.siteUrl);
  if (!opts.file && opts.scrape === undefined) throw new Error("Pass --file <ghost-export.json> or --scrape [site-url]. See --help.");
  return opts;
}

function readHelp() {
  return "Usage: npm run migrate:ghost -- (--file export.json | --scrape [url]) [--tags first-as-category|all-tags] [--download-external] [--update] [--limit n] [--dry-run]";
}

const UA = "Mozilla/5.0 (compatible; blog-migration/1.0)";

async function fetchText(url: string) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function loadPosts(opts: Options): Promise<{ posts: GhostPost[]; failed: { url: string; reason: string }[] }> {
  if (opts.file) {
    const json = JSON.parse(await readFile(opts.file, "utf8"));
    return { posts: parseGhostExport(json, opts.siteUrl), failed: [] };
  }
  const site = opts.siteUrl;
  let urls: string[] = [];
  try {
    urls = parseSitemap(await fetchText(`${site}/sitemap-posts.xml`));
  } catch (err) {
    console.warn(`  sitemap unavailable (${(err as Error).message}), trying RSS…`);
  }
  if (!urls.length) urls = parseRss(await fetchText(`${site}/rss/`));
  urls = [...new Set(urls)];
  if (opts.limit) urls = urls.slice(0, opts.limit);
  console.log(`Found ${urls.length} post URLs`);
  const posts: GhostPost[] = [];
  const failed: { url: string; reason: string }[] = [];
  for (const url of urls) {
    try {
      posts.push(parseGhostPage(await fetchText(url), url, site));
      process.stdout.write(".");
    } catch (err) {
      failed.push({ url, reason: (err as Error).message });
      process.stdout.write("x");
    }
    await new Promise((r) => setTimeout(r, 300)); // be polite to the old server
  }
  process.stdout.write("\n");
  return { posts, failed };
}

async function findOrCreateCategory(name: string) {
  const slug = slugify(name) || `category-${Date.now()}`;
  const existing = await prisma.category.findFirst({ where: { OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }] } });
  return existing ?? prisma.category.create({ data: { name, slug } });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`Ghost migration — source: ${opts.file ? `export file ${opts.file}` : `scrape ${opts.siteUrl}`}${opts.dryRun ? " (dry run)" : ""}`);

  const { posts: all, failed } = await loadPosts(opts);
  const posts = opts.limit ? all.slice(0, opts.limit) : all;
  const report = { imported: [] as string[], updated: [] as string[], skipped: [] as { slug: string; reason: string }[], failed, imagesDownloaded: 0, imagesReused: 0, imageFailures: [] as { url: string; reason: string }[], warnings: [] as string[] };

  for (const post of posts) {
    const label = post.slug;
    try {
      if (!post.slug || !post.title) {
        report.failed.push({ url: post.url, reason: "missing slug or title" });
        continue;
      }
      const existing = await prisma.article.findUnique({ where: { slug: post.slug }, select: { id: true } });
      if (existing && !opts.update) {
        report.skipped.push({ slug: label, reason: "already imported (use --update to overwrite)" });
        // Still make sure the legacy redirect exists.
        if (!opts.dryRun && !RESERVED_SLUGS.has(post.slug)) await upsertRedirect(`/${post.slug}`, `/articles/${post.slug}`);
        continue;
      }

      const converted = convertGhostHtml(post.html, opts.siteUrl);
      report.warnings.push(...converted.warnings.map((w) => `${label}: ${w}`));

      // Images: download own-site images (and optionally external ones) into the media library.
      const map = new Map<string, string | null>();
      const toDownload = converted.images.filter((u) => opts.downloadExternal || isOwnImage(u, opts.siteUrl));
      for (const url of toDownload) {
        if (opts.dryRun) continue;
        try {
          const { media, downloaded } = await importRemoteImage(url);
          map.set(url, `/media/${media.path}`);
          if (downloaded) report.imagesDownloaded++;
          else report.imagesReused++;
        } catch (err) {
          map.set(url, null);
          report.imageFailures.push({ url, reason: (err as Error).message });
        }
      }
      // External images we don't download: unreachable hosts (e.g. *.local) are marked missing.
      for (const url of converted.images.filter((u) => !toDownload.includes(u))) {
        if (/\.(local|localhost|lan|internal)(:\d+)?\//i.test(url)) {
          map.set(url, null);
          report.imageFailures.push({ url, reason: "unreachable host (kept as missing image)" });
        }
      }

      let previewImageId: string | null = null;
      if (post.featureImage && !opts.dryRun) {
        try {
          const { media, downloaded } = await importRemoteImage(post.featureImage, post.featureImageAlt || post.title);
          previewImageId = media.id;
          if (downloaded) report.imagesDownloaded++;
          else report.imagesReused++;
        } catch (err) {
          report.imageFailures.push({ url: post.featureImage, reason: (err as Error).message });
        }
      }

      const html = rewriteImages(converted.html, map);
      const doc = htmlToDoc(html);
      const rendered = await renderDocument(doc);
      const { category, tags } = mapTags(post.tags, opts.tags);

      if (opts.dryRun) {
        report.imported.push(`${label} (dry run: ${doc.content?.length ?? 0} blocks, ${converted.images.length} images, category=${category ?? "—"}, tags=${tags.join("|") || "—"})`);
        continue;
      }

      const categoryId = category ? (await findOrCreateCategory(category)).id : null;
      const tagConnect = await resolveTags(tags);
      const data = {
        title: post.title,
        excerpt: post.excerpt.slice(0, 1000),
        contentJson: doc as object,
        contentHtml: rendered.html,
        contentText: rendered.text,
        toc: rendered.toc,
        readingTime: rendered.readingTime,
        status: "published" as const,
        publishedAt: new Date(post.publishedAt),
        seoTitle: post.metaTitle,
        seoDescription: post.metaDescription,
        legacyUrl: post.url,
        previewImageId,
        categoryId,
      };
      if (existing) {
        await prisma.article.update({ where: { id: existing.id }, data: { ...data, tags: { set: tagConnect } } });
        report.updated.push(label);
      } else {
        await prisma.article.create({ data: { ...data, slug: post.slug, tags: { connect: tagConnect } } });
        report.imported.push(label);
      }
      if (RESERVED_SLUGS.has(post.slug)) report.warnings.push(`${label}: slug collides with a site route; no root redirect created`);
      else await upsertRedirect(`/${post.slug}`, `/articles/${post.slug}`);
    } catch (err) {
      report.failed.push({ url: post.url, reason: (err as Error).message });
    }
  }

  console.log("\n================ Migration report ================");
  console.log(`Imported: ${report.imported.length}`);
  for (const s of report.imported) console.log(`  + ${s}`);
  if (report.updated.length) {
    console.log(`Updated:  ${report.updated.length}`);
    for (const s of report.updated) console.log(`  ~ ${s}`);
  }
  console.log(`Skipped:  ${report.skipped.length}`);
  for (const s of report.skipped) console.log(`  - ${s.slug}: ${s.reason}`);
  console.log(`Failed:   ${report.failed.length}`);
  for (const f of report.failed) console.log(`  ! ${f.url}: ${f.reason}`);
  console.log(`Images downloaded: ${report.imagesDownloaded} (reused from earlier runs: ${report.imagesReused})`);
  if (report.imageFailures.length) {
    console.log(`Image problems: ${report.imageFailures.length}`);
    for (const f of report.imageFailures) console.log(`  ! ${f.url}: ${f.reason}`);
  }
  if (report.warnings.length) {
    console.log("Warnings:");
    for (const w of report.warnings) console.log(`  * ${w}`);
  }
  console.log("==================================================");
  if (!opts.dryRun) console.log("Tip: the public site caches pages for up to a minute; restart the app or save any post to refresh immediately.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(`Migration failed: ${(err as Error).message}`);
    await prisma.$disconnect();
    process.exit(1);
  });
