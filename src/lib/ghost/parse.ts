/**
 * Ghost → new site conversion helpers. Pure functions (no network, no DB) so they can be unit-tested.
 * Used by scripts/migrate-ghost.ts.
 */
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

export type GhostPost = {
  slug: string;
  title: string;
  html: string;
  excerpt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  featureImage: string | null;
  featureImageAlt: string;
  featureImageCaption: string;
  publishedAt: string;
  updatedAt: string | null;
  /** In Ghost's order: the first one is the primary tag. */
  tags: string[];
  url: string;
};

const GHOST_URL = "__GHOST_URL__";

export function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, "");
}

/** Resolves relative/placeholder URLs and strips Ghost's resized variants (/size/w600/...) to get the original. */
export function originalImageUrl(src: string, siteUrl: string): string {
  const site = normalizeSiteUrl(siteUrl);
  let url = src.trim().replace(GHOST_URL, site);
  if (url.startsWith("//")) url = `https:${url}`;
  else if (url.startsWith("/")) url = `${site}${url}`;
  return url.replace(/\/content\/images\/size\/w\d+(?:h\d+)?\/(?:format\/[a-z0-9]+\/)?/i, "/content/images/");
}

/** True for images hosted by the old Ghost site itself (as opposed to hot-linked third-party images). */
export function isOwnImage(url: string, siteUrl: string): boolean {
  try {
    const u = new URL(url);
    return u.host === new URL(siteUrl).host && u.pathname.startsWith("/content/images/");
  } catch {
    return false;
  }
}

/** Removes Ghost's "?ref=<site>" tracking parameter from outbound links. */
export function cleanLink(href: string, siteUrl: string): string {
  try {
    const u = new URL(href.replace(GHOST_URL, normalizeSiteUrl(siteUrl)));
    if (u.searchParams.get("ref") === new URL(siteUrl).host) u.searchParams.delete("ref");
    return u.toString();
  } catch {
    return href;
  }
}

/* ------------------------------ export JSON ------------------------------ */

type ExportPost = {
  id: string; title: string; slug: string; html: string | null; status: string; type?: string;
  feature_image: string | null; feature_image_alt?: string | null; feature_image_caption?: string | null;
  custom_excerpt: string | null; plaintext?: string | null; meta_title?: string | null; meta_description?: string | null;
  published_at: string | null; updated_at: string | null; created_at?: string | null;
};
type ExportData = {
  posts?: ExportPost[];
  tags?: { id: string; name: string; slug: string; visibility?: string }[];
  posts_tags?: { post_id: string; tag_id: string; sort_order?: number }[];
  posts_meta?: { post_id: string; meta_title?: string | null; meta_description?: string | null; feature_image_alt?: string | null; feature_image_caption?: string | null }[];
};

/** Reads a Ghost Admin export (Settings → Advanced → Export). Returns published posts only (not pages). */
export function parseGhostExport(json: unknown, siteUrl: string): GhostPost[] {
  const root = json as { db?: { data?: ExportData }[]; data?: ExportData };
  const data: ExportData | undefined = root.db?.[0]?.data ?? root.data;
  if (!data?.posts) throw new Error("Not a Ghost export: no posts found (expected db[0].data.posts)");
  const site = normalizeSiteUrl(siteUrl);
  const tagsById = new Map((data.tags ?? []).map((t) => [t.id, t]));
  const meta = new Map((data.posts_meta ?? []).map((m) => [m.post_id, m]));

  return data.posts
    .filter((p) => p.status === "published" && (p.type ?? "post") === "post")
    .map((p) => {
      const m = meta.get(p.id);
      const tags = (data.posts_tags ?? [])
        .filter((pt) => pt.post_id === p.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((pt) => tagsById.get(pt.tag_id))
        // Internal tags (#hash) are Ghost-only helpers.
        .filter((t): t is NonNullable<typeof t> => !!t && t.visibility !== "internal" && !t.name.startsWith("#"))
        .map((t) => t.name);
      const html = (p.html ?? "").replaceAll(GHOST_URL, site);
      return {
        slug: p.slug,
        title: p.title,
        html,
        excerpt: p.custom_excerpt ?? m?.meta_description ?? p.meta_description ?? excerptFromText(p.plaintext ?? stripTags(html)),
        metaTitle: m?.meta_title ?? p.meta_title ?? null,
        metaDescription: m?.meta_description ?? p.meta_description ?? null,
        featureImage: p.feature_image ? originalImageUrl(p.feature_image, site) : null,
        featureImageAlt: m?.feature_image_alt ?? p.feature_image_alt ?? "",
        featureImageCaption: stripTags(m?.feature_image_caption ?? p.feature_image_caption ?? ""),
        publishedAt: new Date(p.published_at ?? p.created_at ?? Date.now()).toISOString(),
        updatedAt: p.updated_at ? new Date(p.updated_at).toISOString() : null,
        tags,
        url: `${site}/${p.slug}/`,
      };
    });
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function excerptFromText(text: string, max = 200) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/* -------------------------------- scraping ------------------------------- */

/** Post URLs from a Ghost sitemap (sitemap-posts.xml). */
export function parseSitemap(xml: string): string[] {
  const $ = cheerio.load(xml, { xml: true });
  return $("url > loc")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

/** Post URLs from a Ghost RSS feed (fallback). */
export function parseRss(xml: string): string[] {
  const $ = cheerio.load(xml, { xml: true });
  return $("item > link")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

export function slugFromUrl(url: string): string {
  return new URL(url).pathname.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
}

/** Extracts a post from a rendered Ghost page (Casper/Source-style themes; falls back to meta tags). */
export function parseGhostPage(pageHtml: string, url: string, siteUrl: string): GhostPost {
  const $ = cheerio.load(pageHtml);
  const meta = (sel: string) => $(sel).attr("content")?.trim() || null;
  const ld = (() => {
    try {
      return JSON.parse($('script[type="application/ld+json"]').first().text()) as { headline?: string; datePublished?: string; dateModified?: string; keywords?: string };
    } catch {
      return {};
    }
  })();

  const content = $(".gh-content, .post-content, .article-content, .post-full-content").first();
  if (!content.length) throw new Error("Could not find the article body (.gh-content)");

  const featureImg = $(".gh-article-image img, .article-image img, .post-full-image img").first();
  const featureSrc = meta('meta[property="og:image"]') ?? featureImg.attr("src") ?? null;
  const tags = [
    ...$('meta[property="article:tag"]').map((_, el) => $(el).attr("content")?.trim() ?? "").get(),
    ...(ld.keywords ? ld.keywords.split(",").map((k) => k.trim()) : []),
  ].filter(Boolean);
  const primary = $(".gh-article-tag, .article-tag a, .post-full-tags a").first().text().trim();
  if (primary && !tags.includes(primary)) tags.unshift(primary);

  const title = $(".gh-article-title, .article-title, .post-full-title").first().text().trim() || ld.headline || meta('meta[property="og:title"]') || $("title").text().trim();
  const description = meta('meta[name="description"]') ?? meta('meta[property="og:description"]');
  const customExcerpt = $(".gh-article-excerpt, .article-excerpt, .post-full-custom-excerpt").first().text().trim();

  return {
    slug: slugFromUrl(url),
    title,
    html: content.html() ?? "",
    excerpt: customExcerpt || description || "",
    metaTitle: null,
    metaDescription: description,
    featureImage: featureSrc ? originalImageUrl(featureSrc, siteUrl) : null,
    featureImageAlt: featureImg.attr("alt")?.trim() ?? "",
    featureImageCaption: $(".gh-article-image figcaption, .article-image figcaption").first().text().trim(),
    publishedAt: new Date(meta('meta[property="article:published_time"]') ?? ld.datePublished ?? $("time[datetime]").first().attr("datetime") ?? Date.now()).toISOString(),
    updatedAt: meta('meta[property="article:modified_time"]') ?? ld.dateModified ?? null,
    tags: [...new Set(tags)],
    url,
  };
}

/* -------------------------- card / HTML conversion ------------------------- */

export type ConvertedHtml = { html: string; images: string[]; warnings: string[] };

function figure($: cheerio.CheerioAPI, src: string, alt: string, caption: string, size = 100, width?: string, height?: string) {
  const fig = $("<figure></figure>").attr("data-size", String(size)).attr("data-align", "center");
  const img = $("<img>").attr("src", src).attr("alt", alt);
  if (width) img.attr("width", width);
  if (height) img.attr("height", height);
  fig.append(img);
  if (caption) fig.append($("<figcaption></figcaption>").text(caption));
  return fig;
}

/**
 * Rewrites Ghost card markup into the HTML the editor schema understands
 * (figure/img/figcaption, aside.callout, div[data-embed], pre>code).
 * Returns the list of image URLs (originals) so the caller can download and rewrite them.
 */
export function convertGhostHtml(input: string, siteUrl: string): ConvertedHtml {
  const $ = cheerio.load(`<div id="__root">${input.replace(/<!--\s*kg-card-(begin|end):[^>]*-->/g, "")}</div>`);
  const root = $("#__root");
  const warnings: string[] = [];
  const images = new Set<string>();
  const imgUrl = (el: cheerio.Cheerio<AnyNode>) => {
    const src = el.attr("src") ?? el.attr("data-src") ?? "";
    return src ? originalImageUrl(src, siteUrl) : "";
  };

  // Image cards
  root.find("figure.kg-image-card").each((_, el) => {
    const f = $(el);
    const img = f.find("img").first();
    const src = imgUrl(img);
    if (!src) return void f.remove();
    const caption = f.find("figcaption").text().trim();
    f.replaceWith(figure($, src, img.attr("alt") ?? "", caption, 100, img.attr("width"), img.attr("height")));
  });

  // Galleries → one figure per image (first carries the caption)
  root.find("figure.kg-gallery-card").each((_, el) => {
    const f = $(el);
    const caption = f.find("figcaption").text().trim();
    const figs = f
      .find("img")
      .toArray()
      .map((img, i) => $.html(figure($, imgUrl($(img)), $(img).attr("alt") ?? "", i === 0 ? caption : "", 100, $(img).attr("width"), $(img).attr("height"))));
    // replaceWith takes a single argument, so pass the combined markup.
    f.replaceWith(figs.join(""));
  });

  // Callouts
  root.find("div.kg-callout-card").each((_, el) => {
    const c = $(el);
    const emoji = c.find(".kg-callout-emoji").text().trim();
    const text = c.find(".kg-callout-text").html() ?? c.text();
    c.replaceWith($("<aside></aside>").addClass("callout").attr("data-emoji", emoji || null).append($('<div class="callout-body"></div>').append(`<p>${text}</p>`)));
  });

  // Bookmarks → link cards
  root.find("figure.kg-bookmark-card").each((_, el) => {
    const b = $(el);
    const href = cleanLink(b.find("a.kg-bookmark-container").attr("href") ?? b.find("a").attr("href") ?? "", siteUrl);
    const title = b.find(".kg-bookmark-title").text().trim();
    const desc = b.find(".kg-bookmark-description").text().trim();
    if (!href) return void b.remove();
    const card = $("<div></div>").attr("data-embed", "link").attr("data-url", href);
    card.append($('<span class="bookmark-title"></span>').text(title), $('<span class="bookmark-description"></span>').text(desc));
    b.replaceWith(card);
  });

  // Embeds: YouTube → video embed; anything else → link if we can find one
  root.find("figure.kg-embed-card").each((_, el) => {
    const e = $(el);
    const iframe = e.find("iframe").attr("src") ?? "";
    const yt = iframe.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/);
    if (yt) {
      e.replaceWith($("<div></div>").attr("data-embed", "youtube").attr("data-url", `https://www.youtube.com/watch?v=${yt[1]}`));
      return;
    }
    const href = e.find("a[href]").last().attr("href") ?? iframe;
    if (href) {
      warnings.push(`Embed converted to a link: ${href}`);
      e.replaceWith($("<p></p>").append($("<a></a>").attr("href", cleanLink(href, siteUrl)).text(href)));
    } else {
      warnings.push("Removed an embed without a URL");
      e.remove();
    }
  });

  // Buttons → plain links
  root.find("div.kg-button-card").each((_, el) => {
    const a = $(el).find("a").first();
    const href = a.attr("href");
    $(el).replaceWith(href ? $("<p></p>").append($("<a></a>").attr("href", cleanLink(href, siteUrl)).text(a.text().trim() || href)) : "");
  });

  // Toggles → bold heading + content; headers → h2 + text
  root.find("div.kg-toggle-card").each((_, el) => {
    const t = $(el);
    const heading = t.find(".kg-toggle-heading-text").text().trim();
    const content = t.find(".kg-toggle-content").html() ?? "";
    t.replaceWith(`<p><strong>${$("<i>").text(heading).html()}</strong></p>${content}`);
  });
  root.find("div.kg-header-card").each((_, el) => {
    const h = $(el);
    const title = h.find(".kg-header-card-header, h2").first().text().trim();
    const sub = h.find(".kg-header-card-subheader, h3").first().text().trim();
    h.replaceWith(`<h2>${$("<i>").text(title).html()}</h2>${sub ? `<p>${$("<i>").text(sub).html()}</p>` : ""}`);
  });

  // Video/audio/file/product cards → links to the media
  root.find("figure.kg-video-card, div.kg-audio-card, div.kg-file-card, div.kg-product-card").each((_, el) => {
    const n = $(el);
    const src = n.find("video").attr("src") ?? n.find("audio").attr("src") ?? n.find("a[href]").attr("href");
    const label = n.find(".kg-file-card-title, .kg-audio-title, .kg-product-card-title").first().text().trim() || "Media";
    if (src) {
      warnings.push(`Media card converted to a link: ${src}`);
      n.replaceWith($("<p></p>").append($("<a></a>").attr("href", originalImageUrl(src, siteUrl)).text(label)));
    } else n.remove();
  });

  // Code cards: keep <pre><code class="language-x">, drop the figure wrapper (caption becomes a paragraph)
  root.find("figure.kg-code-card").each((_, el) => {
    const f = $(el);
    const caption = f.find("figcaption").text().trim();
    const pre = $.html(f.find("pre").first());
    f.replaceWith(pre + (caption ? $.html($("<p></p>").append($("<em></em>").text(caption))) : ""));
  });

  // Signup/CTA/paywall markers have no equivalent.
  root.find(".kg-signup-card, .kg-cta-card, .kg-nft-card").remove();

  // Loose images not in a figure: keep as figures so the editor handles them.
  root.find("img").each((_, el) => {
    const img = $(el);
    const src = imgUrl(img);
    if (!src) return void img.remove();
    img.attr("src", src);
    img.removeAttr("srcset").removeAttr("sizes").removeAttr("loading").removeAttr("class").removeAttr("style");
    images.add(src);
  });

  // Outbound links: drop ?ref=site.
  root.find("a[href]").each((_, el) => {
    $(el).attr("href", cleanLink($(el).attr("href")!, siteUrl));
  });

  // Unknown leftovers: unwrap remaining kg-card wrappers so their content is kept.
  root.find("[class*='kg-']").each((_, el) => {
    const n = $(el);
    if (n.is("figure, div") && n.hasClass("kg-card")) {
      warnings.push(`Unknown card kept as plain content: ${n.attr("class")}`);
      n.replaceWith(n.contents());
    } else n.removeAttr("class");
  });

  return { html: root.html() ?? "", images: [...images], warnings };
}

/** Replaces image URLs in converted HTML; unresolved ones are marked as missing. */
export function rewriteImages(html: string, map: Map<string, string | null>): string {
  const $ = cheerio.load(`<div id="__root">${html}</div>`);
  $("#__root img").each((_, el) => {
    const img = $(el);
    const src = img.attr("src") ?? "";
    if (!map.has(src)) return;
    const local = map.get(src);
    if (local) img.attr("src", local);
    else img.closest("figure").attr("data-missing", "true");
  });
  return $("#__root").html() ?? "";
}

/** First tag → category, the rest → tags (configurable). */
export function mapTags(tags: string[], mode: "first-as-category" | "all-tags"): { category: string | null; tags: string[] } {
  if (mode === "all-tags" || tags.length === 0) return { category: null, tags };
  return { category: tags[0]!, tags: tags.slice(1) };
}
