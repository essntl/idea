import { describe, it, expect } from "vitest";
import {
  convertGhostHtml, mapTags, originalImageUrl, parseGhostExport, parseGhostPage, parseSitemap, parseRss, rewriteImages, cleanLink, isOwnImage,
} from "@/lib/ghost/parse";
import { htmlToDoc } from "@/lib/content/html-to-doc";

const SITE = "https://old.example.com";

describe("image URLs", () => {
  it("strips Ghost size variants to get the original image", () => {
    expect(originalImageUrl("/content/images/size/w600/2024/01/a.jpg", SITE)).toBe(`${SITE}/content/images/2024/01/a.jpg`);
    expect(originalImageUrl(`${SITE}/content/images/size/w1000/format/webp/2024/01/a.png`, SITE)).toBe(`${SITE}/content/images/2024/01/a.png`);
    expect(originalImageUrl("__GHOST_URL__/content/images/2024/01/b.png", SITE)).toBe(`${SITE}/content/images/2024/01/b.png`);
  });
  it("tells own images from hot-linked ones", () => {
    expect(isOwnImage(`${SITE}/content/images/x.png`, SITE)).toBe(true);
    expect(isOwnImage("https://cdn.other.com/x.png", SITE)).toBe(false);
  });
  it("removes Ghost's ref= tracking parameter", () => {
    expect(cleanLink("https://discord.gg/abc?ref=old.example.com", SITE)).toBe("https://discord.gg/abc");
    expect(cleanLink("https://x.com/?ref=someone-else", SITE)).toBe("https://x.com/?ref=someone-else");
  });
});

describe("Ghost export JSON", () => {
  const exportJson = {
    db: [
      {
        meta: { version: "6.0.0" },
        data: {
          posts: [
            {
              id: "p1", title: "Hello", slug: "hello-world", status: "published", type: "post",
              html: '<p>Hi <a href="__GHOST_URL__/other/">link</a></p>',
              feature_image: "__GHOST_URL__/content/images/size/w2000/2023/05/cover.jpg",
              custom_excerpt: null, plaintext: "Hi link", published_at: "2023-05-04T10:00:00.000Z", updated_at: "2023-06-01T00:00:00.000Z",
            },
            { id: "p2", title: "Draft", slug: "draft", status: "draft", type: "post", html: "<p>x</p>", feature_image: null, custom_excerpt: null, published_at: null, updated_at: null },
            { id: "p3", title: "About", slug: "about", status: "published", type: "page", html: "<p>x</p>", feature_image: null, custom_excerpt: null, published_at: "2023-01-01T00:00:00.000Z", updated_at: null },
          ],
          tags: [
            { id: "t1", name: "Linux", slug: "linux" },
            { id: "t2", name: "Guides", slug: "guides" },
            { id: "t3", name: "#internal", slug: "hash-internal", visibility: "internal" },
          ],
          posts_tags: [
            { post_id: "p1", tag_id: "t2", sort_order: 1 },
            { post_id: "p1", tag_id: "t1", sort_order: 0 },
            { post_id: "p1", tag_id: "t3", sort_order: 2 },
          ],
          posts_meta: [{ post_id: "p1", meta_title: "SEO Hello", meta_description: "Meta desc", feature_image_alt: "Cover alt", feature_image_caption: "<span>Cap</span>" }],
        },
      },
    ],
  };

  const posts = parseGhostExport(exportJson, SITE);

  it("keeps only published posts (not drafts or pages)", () => {
    expect(posts.map((p) => p.slug)).toEqual(["hello-world"]);
  });

  it("preserves slug, dates and metadata", () => {
    const p = posts[0]!;
    expect(p).toMatchObject({
      title: "Hello",
      publishedAt: "2023-05-04T10:00:00.000Z",
      metaTitle: "SEO Hello",
      metaDescription: "Meta desc",
      excerpt: "Meta desc",
      featureImage: `${SITE}/content/images/2023/05/cover.jpg`,
      featureImageAlt: "Cover alt",
      featureImageCaption: "Cap",
      url: `${SITE}/hello-world/`,
    });
    expect(p.html).toContain(`${SITE}/other/`);
  });

  it("orders tags by sort_order and drops internal tags", () => {
    expect(posts[0]!.tags).toEqual(["Linux", "Guides"]);
    expect(mapTags(posts[0]!.tags, "first-as-category")).toEqual({ category: "Linux", tags: ["Guides"] });
    expect(mapTags(posts[0]!.tags, "all-tags")).toEqual({ category: null, tags: ["Linux", "Guides"] });
  });

  it("rejects files that are not Ghost exports", () => {
    expect(() => parseGhostExport({ foo: 1 }, SITE)).toThrow(/Not a Ghost export/);
  });
});

describe("scraping", () => {
  it("reads post URLs from a sitemap and RSS", () => {
    const sitemap = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/a/</loc></url><url><loc>${SITE}/b/</loc><image:image><image:loc>${SITE}/content/images/x.png</image:loc></image:image></url></urlset>`;
    expect(parseSitemap(sitemap)).toEqual([`${SITE}/a/`, `${SITE}/b/`]);
    expect(parseRss(`<rss><channel><item><link>${SITE}/c/</link></item></channel></rss>`)).toEqual([`${SITE}/c/`]);
  });

  it("extracts a post from a rendered Ghost page", () => {
    const page = `<html><head>
      <title>Page title</title>
      <meta name="description" content="Desc here">
      <meta property="og:image" content="${SITE}/content/images/size/w1200/2024/02/feat.jpg">
      <meta property="article:published_time" content="2024-02-03T04:05:06.000Z">
      <meta property="article:modified_time" content="2024-03-01T00:00:00.000Z">
      <meta property="article:tag" content="Windows">
      <meta property="article:tag" content="Tips">
      </head><body>
      <article><header><h1 class="gh-article-title">My Post</h1><p class="gh-article-excerpt">Custom excerpt</p>
      <figure class="gh-article-image"><img src="/content/images/size/w600/2024/02/feat.jpg" alt="Feature alt"></figure></header>
      <section class="gh-content gh-canvas"><p>Body</p></section></article></body></html>`;
    const p = parseGhostPage(page, `${SITE}/my-post/`, SITE);
    expect(p).toMatchObject({
      slug: "my-post",
      title: "My Post",
      excerpt: "Custom excerpt",
      metaDescription: "Desc here",
      featureImage: `${SITE}/content/images/2024/02/feat.jpg`,
      featureImageAlt: "Feature alt",
      publishedAt: "2024-02-03T04:05:06.000Z",
      tags: ["Windows", "Tips"],
    });
    expect(p.html).toContain("<p>Body</p>");
  });

  it("fails clearly when the body cannot be found", () => {
    expect(() => parseGhostPage("<html><body><p>x</p></body></html>", `${SITE}/x/`, SITE)).toThrow(/article body/);
  });
});

describe("card conversion", () => {
  const html = [
    '<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/content/images/size/w600/2024/01/pic.png" class="kg-image" alt="Alt" width="600" height="400" srcset="x 600w"><figcaption><span>Caption</span></figcaption></figure>',
    '<figure class="kg-card kg-gallery-card"><div class="kg-gallery-container"><div class="kg-gallery-row"><div class="kg-gallery-image"><img src="/content/images/g1.jpg" alt="g1"></div><div class="kg-gallery-image"><img src="/content/images/g2.jpg" alt="g2"></div></div></div></figure>',
    '<div class="kg-card kg-callout-card kg-callout-card-grey"><div class="kg-callout-emoji">💡</div><div class="kg-callout-text">Note <b>this</b></div></div>',
    '<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://example.org/page?ref=old.example.com"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Example</div><div class="kg-bookmark-description">An example page</div></div></a></figure>',
    '<figure class="kg-card kg-embed-card"><iframe src="https://www.youtube.com/embed/I-WsdkImhxo?feature=oembed"></iframe></figure>',
    '<div class="kg-card kg-button-card kg-align-left"><a href="https://discord.gg/abc?ref=old.example.com" class="kg-btn kg-btn-accent">Discord</a></div>',
    '<figure class="kg-card kg-code-card"><pre><code class="language-bash">sudo dnf update</code></pre><figcaption>Update first</figcaption></figure>',
    '<div class="kg-card kg-toggle-card"><div class="kg-toggle-heading"><h4 class="kg-toggle-heading-text">Q?</h4></div><div class="kg-toggle-content"><p>A.</p></div></div>',
    '<figure class="kg-card kg-image-card"><img src="https://dead.host.local/wp-content/a.png" alt=""></figure>',
    "<!--kg-card-begin: html--><p>raw</p><!--kg-card-end: html-->",
  ].join("");

  const out = convertGhostHtml(html, SITE);

  it("collects original-size image URLs", () => {
    expect(out.images).toEqual([
      `${SITE}/content/images/2024/01/pic.png`,
      `${SITE}/content/images/g1.jpg`,
      `${SITE}/content/images/g2.jpg`,
      "https://dead.host.local/wp-content/a.png",
    ]);
  });

  it("produces markup the editor schema understands", () => {
    const local = new Map<string, string | null>([
      [`${SITE}/content/images/2024/01/pic.png`, "/media/2026/01/pic.webp"],
      [`${SITE}/content/images/g1.jpg`, "/media/2026/01/g1.webp"],
      [`${SITE}/content/images/g2.jpg`, "/media/2026/01/g2.webp"],
      ["https://dead.host.local/wp-content/a.png", null],
    ]);
    const doc = htmlToDoc(rewriteImages(out.html, local));
    const nodes = doc.content!;
    const images = nodes.filter((n) => n.type === "image");
    expect(images.map((i) => i.attrs?.src)).toEqual(["/media/2026/01/pic.webp", "/media/2026/01/g1.webp", "/media/2026/01/g2.webp", "https://dead.host.local/wp-content/a.png"]);
    expect(images[0]!.attrs).toMatchObject({ alt: "Alt", caption: "Caption", width: 600, height: 400 });
    expect(images[3]!.attrs?.missing).toBe(true);

    const callout = nodes.find((n) => n.type === "callout")!;
    expect(callout.attrs?.emoji).toBe("💡");
    expect(JSON.stringify(callout)).toContain("this");

    const embeds = nodes.filter((n) => n.type === "embed");
    expect(embeds.map((e) => e.attrs?.url)).toEqual(["https://example.org/page", "https://www.youtube.com/watch?v=I-WsdkImhxo"]);
    expect(embeds[0]!.attrs?.title).toBe("Example");

    const code = nodes.find((n) => n.type === "codeBlock")!;
    expect(code.attrs?.language).toBe("bash");
    expect(code.content?.[0]?.text).toBe("sudo dnf update");

    const text = JSON.stringify(doc);
    expect(text).toContain("https://discord.gg/abc");
    expect(text).not.toContain("ref=old.example.com");
    expect(text).toContain("Q?");
    expect(text).toContain("raw");
  });
});
