import { getFeedItems } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** Combined feed of articles and blog posts. Relative URLs in content are made absolute. */
export async function GET() {
  const [items, s] = await Promise.all([getFeedItems(30), getSettings()]);
  const base = siteUrl();
  const abs = (html: string) => html.replace(/(src|href|srcset)="\/(?!\/)/g, `$1="${base}/`).replace(/, \/media\//g, `, ${base}/media/`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>${esc(s.siteTitle)}</title>
<link>${base}/</link>
<description>${esc(s.siteDescription)}</description>
<language>en</language>
<atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (i) => `<item>
<title>${esc(i.title)}</title>
<link>${base}${i.url}</link>
<guid isPermaLink="true">${base}${i.url}</guid>
<pubDate>${new Date(i.publishedAt).toUTCString()}</pubDate>
<category>${i.kind === "article" ? "Articles" : "Blog"}</category>
<description>${esc(i.description)}</description>
<content:encoded>${cdata(abs(i.html))}</content:encoded>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}
