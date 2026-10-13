import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/queries";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { articles, posts, categories, tags } = await getSitemapEntries();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/articles`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    ...articles.map((a) => ({ url: `${base}/articles/${a.slug}`, lastModified: a.updatedAt, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 })),
    ...categories.map((c) => ({ url: `${base}/articles/category/${c.slug}`, priority: 0.5 })),
    ...tags.map((t) => ({ url: `${base}/articles/tag/${t.slug}`, priority: 0.3 })),
  ];
}
