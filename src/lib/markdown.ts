/**
 * Markdown import/export. Pure functions (no DB), so they are unit-testable.
 */
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";
import { visit } from "unist-util-visit";
import type { Root as HastRoot, Element } from "hast";
import type { JSONContent } from "@tiptap/core";
import { htmlToDoc } from "./content/html-to-doc";
import { renderContentToHtml } from "./content/pipeline";

export type FrontMatter = {
  title?: string;
  description?: string;
  slug?: string;
  tags: string[];
  category?: string;
  date?: string;
  image?: string;
};

export type MarkdownImport = {
  frontMatter: FrontMatter;
  title: string;
  doc: JSONContent;
  /** Image references that could not be resolved (shown as "missing" in the editor). */
  unresolvedImages: string[];
};

function str(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}

export function normalizeFrontMatter(data: Record<string, unknown>): FrontMatter {
  const rawTags = data.tags ?? data.keywords;
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t) => str(t)).filter((t): t is string => !!t)
    : (str(rawTags)?.split(",").map((t) => t.trim()).filter(Boolean) ?? []);
  const rawCategory = data.category ?? (Array.isArray(data.categories) ? data.categories[0] : data.categories);
  const date = str(data.date ?? data.published ?? data.publishedAt);
  return {
    title: str(data.title),
    description: str(data.description ?? data.excerpt ?? data.summary),
    slug: str(data.slug),
    tags: [...new Set(tags)],
    category: str(rawCategory),
    date: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : undefined,
    image: str(data.image ?? data.cover ?? data.feature_image ?? data.featureImage),
  };
}

export function isRemoteUrl(src: string) {
  return /^https?:\/\//i.test(src);
}

/** GFM task lists → TipTap's taskList/taskItem markup. */
function rehypeTaskLists() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      const cls = (node.properties.className as string[] | undefined) ?? [];
      if (node.tagName === "ul" && cls.includes("contains-task-list")) {
        node.properties = { dataType: "taskList" };
      }
      if (node.tagName === "li" && cls.includes("task-list-item")) {
        let checked = false;
        const strip = (children: Element["children"]): Element["children"] =>
          children.filter((c) => {
            if (c.type === "element" && c.tagName === "input") {
              checked = c.properties.checked === true || c.properties.checked === "";
              return false;
            }
            if (c.type === "element" && c.tagName === "p") c.children = strip(c.children);
            return true;
          });
        node.children = strip(node.children);
        node.properties = { dataType: "taskItem", dataChecked: String(checked) };
      }
    });
  };
}

/**
 * Converts a markdown file into editor content.
 * `resolveImage` maps a local reference to a media URL (or null if it can't be found).
 */
export function parseMarkdown(source: string, resolveImage: (ref: string) => string | null = () => null): MarkdownImport {
  const { data, content } = matter(source.replace(/^﻿/, ""));
  const frontMatter = normalizeFrontMatter(data);
  let body = content;
  let title = frontMatter.title ?? "";
  if (!title) {
    // Use a leading "# Heading" as the title.
    const m = body.match(/^\s*#\s+(.+?)\s*#*\s*(\r?\n|$)/);
    if (m) {
      title = m[1]!.trim();
      body = body.slice(m[0].length);
    }
  }

  const unresolved = new Set<string>();
  const html = String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeTaskLists)
      .use(() => (tree: HastRoot) => {
        visit(tree, "element", (node: Element) => {
          if (node.tagName !== "img" || typeof node.properties.src !== "string") return;
          const src = decodeURI(node.properties.src);
          if (isRemoteUrl(src) || src.startsWith("/media/")) return;
          const resolved = resolveImage(src);
          if (resolved) node.properties.src = resolved;
          else {
            unresolved.add(src);
            node.properties.dataMissing = "true";
          }
        });
      })
      .use(rehypeStringify)
      .processSync(body),
  );

  const doc = htmlToDoc(html);
  // Mark unresolved images so the editor can prompt for an upload.
  const mark = (n: JSONContent) => {
    if (n.type === "image" && typeof n.attrs?.src === "string" && unresolved.has(n.attrs.src)) n.attrs.missing = true;
    n.content?.forEach(mark);
  };
  mark(doc);
  return { frontMatter, title, doc, unresolvedImages: [...unresolved] };
}

/* --------------------------------- export --------------------------------- */

export type ExportMeta = {
  title: string;
  description?: string;
  slug?: string;
  tags?: string[];
  category?: string | null;
  date?: string | null;
  image?: string | null;
};

/** Editor JSON → markdown with YAML front matter. */
export function exportMarkdown(doc: JSONContent, meta: ExportMeta): string {
  const html = renderContentToHtml(doc);
  const md = String(
    unified()
      .use(rehypeParse, { fragment: true })
      .use(() => (tree: HastRoot) => {
        visit(tree, "element", (node: Element, index, parent) => {
          if (!parent || index === undefined) return;
          // <figure><img><figcaption> → image whose title is the caption.
          if (node.tagName === "figure") {
            const img = node.children.find((c): c is Element => c.type === "element" && c.tagName === "img");
            const cap = node.children.find((c): c is Element => c.type === "element" && c.tagName === "figcaption");
            if (img) {
              const caption = cap?.children.map((c) => (c.type === "text" ? c.value : "")).join("");
              const image: Element = { ...img, properties: { src: img.properties.src, alt: img.properties.alt, title: caption || undefined } };
              parent.children[index] = { type: "element", tagName: "p", properties: {}, children: [image] };
            }
          }
          // Embeds → plain links.
          if (node.tagName === "div" && typeof node.properties.dataUrl === "string") {
            const url = node.properties.dataUrl;
            parent.children[index] = { type: "element", tagName: "p", properties: {}, children: [{ type: "element", tagName: "a", properties: { href: url }, children: [{ type: "text", value: url }] }] };
          }
          // Task items → GFM checkboxes.
          if (node.tagName === "li" && node.properties.dataType === "taskItem") {
            const checked = node.properties.dataChecked === "true";
            node.children = node.children.filter((c) => !(c.type === "element" && (c.tagName === "input" || c.tagName === "label")));
            node.children.unshift({ type: "element", tagName: "input", properties: { type: "checkbox", checked, disabled: true }, children: [] });
          }
        });
      })
      .use(rehypeRemark)
      .use(remarkGfm)
      .use(remarkStringify, { bullet: "-", emphasis: "*", strong: "*", fences: true, rule: "-" })
      .processSync(html),
  );

  const fm: Record<string, unknown> = { title: meta.title };
  if (meta.description) fm.description = meta.description;
  if (meta.slug) fm.slug = meta.slug;
  if (meta.date) fm.date = meta.date;
  if (meta.category) fm.category = meta.category;
  if (meta.tags?.length) fm.tags = meta.tags;
  if (meta.image) fm.image = meta.image;
  return matter.stringify(md, fm);
}
