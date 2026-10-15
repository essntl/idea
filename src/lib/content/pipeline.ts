/**
 * Content pipeline: editor JSON → static HTML → sanitized → heading ids/TOC → responsive images → Shiki.
 * Pure module (no Next.js imports) so scripts and tests can use it.
 */
import type { JSONContent } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { createHighlighter, type HighlighterGeneric } from "shiki";
import { toString as hastToString } from "hast-util-to-string";
import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";
import { schemaExtensions } from "./extensions";
import { monoDark, monoLight } from "./shiki-themes";
import { IMAGE_WIDTHS } from "../image-widths";
import { CODE_LANGUAGES } from "./languages";

export type TocItem = { id: string; text: string; level: number };
export type RenderResult = { html: string; text: string; toc: TocItem[]; readingTime: number };

export { CODE_LANGUAGES };

const extensions = schemaExtensions();

export function renderContentToHtml(json: JSONContent): string {
  if (!json || json.type !== "doc") return "";
  return renderToHTMLString({ extensions, content: json });
}

const youtubeSrc = /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]+$/;

export const contentSanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "figure", "figcaption", "aside", "mark", "u", "iframe", "colgroup", "col", "label"],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []).filter((a) => a !== "id")],
    a: [...(defaultSchema.attributes?.a ?? []), "title"],
    code: [["className", /^language-[\w+#-]+$/]],
    figure: [["dataSize", "25", "50", "75", "100"], ["dataAlign", "left", "center", "right"], ["dataMissing", "true"]],
    img: [...(defaultSchema.attributes?.img ?? []), "loading", "decoding", "width", "height"],
    aside: [["className", "callout"], "dataEmoji"],
    div: [
      ["className", "callout-body", "embed-video", "bookmark", "tableWrapper"],
      ["dataEmbed", "youtube", "link"],
      "dataUrl",
    ],
    span: [["className", "bookmark-title", "bookmark-description", "bookmark-host"], ["style", /^color:\s*(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\));?$/i]],
    ul: [["dataType", "taskList"]],
    li: [["dataType", "taskItem"], ["dataChecked", "true", "false"]],
    td: [...(defaultSchema.attributes?.td ?? []), "colspan", "rowspan", "colSpan", "rowSpan"],
    th: [...(defaultSchema.attributes?.th ?? []), "colspan", "rowspan", "colSpan", "rowSpan"],
    iframe: [["src", youtubeSrc], "title", "loading", "allow", "allowFullScreen"],
    mark: [],
  },
  protocols: { ...defaultSchema.protocols, src: ["http", "https"] },
  clobberPrefix: "",
};

let highlighterPromise: Promise<HighlighterGeneric<string, string>> | null = null;
export function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: [monoLight, monoDark],
    langs: CODE_LANGUAGES.filter((l) => l !== "plaintext"),
  }) as Promise<HighlighterGeneric<string, string>>;
  return highlighterPromise;
}

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "li", "pre", "figcaption", "td", "th", "blockquote", "div", "br", "aside"]);

/** Plain text with whitespace between block elements (used for search and reading time). */
export function plainText(tree: Root | Element): string {
  const parts: string[] = [];
  visit(tree, (node) => {
    if (node.type === "text") parts.push(node.value);
    else if (node.type === "element" && BLOCK_TAGS.has(node.tagName)) parts.push(" ");
  });
  return parts.join("").replace(/\s+/g, " ").trim();
}

function rehypeEnhance(toc: TocItem[], textOut: { value: string }) {
  return () => (tree: Root) => {
    textOut.value = plainText(tree);
    visit(tree, "element", (node: Element, _index, parent) => {
      if (/^h[1-3]$/.test(node.tagName) && typeof node.properties.id === "string") {
        toc.push({ id: node.properties.id, text: hastToString(node).trim(), level: Number(node.tagName[1]) });
      }
      if (node.tagName === "img" && typeof node.properties.src === "string") {
        const src = node.properties.src;
        if (src.startsWith("/media/") && !/\.(svg|gif)$/i.test(src)) {
          const size = Number((parent as Element | undefined)?.properties?.dataSize ?? 100) || 100;
          node.properties.srcSet = IMAGE_WIDTHS.map((w) => `${src}?w=${w} ${w}w`).join(", ");
          node.properties.sizes = `(min-width: 768px) ${Math.round((720 * size) / 100)}px, ${size}vw`;
          node.properties.src = `${src}?w=1200`;
        }
      }
      if (node.tagName === "a" && typeof node.properties.href === "string" && /^https?:\/\//.test(node.properties.href)) {
        node.properties.rel = ["noopener", "noreferrer"];
      }
      if (node.tagName === "table" && parent && "children" in parent) {
        // Wrap tables so they scroll horizontally inside their own container on small screens.
        const idx = parent.children.indexOf(node);
        const isWrapped = (parent as Element).tagName === "div" && ((parent as Element).properties?.className as string[] | undefined)?.includes("table-scroll");
        if (idx >= 0 && !isWrapped) {
          parent.children[idx] = { type: "element", tagName: "div", properties: { className: ["table-scroll"] }, children: [node] };
        }
      }
    });
  };
}

/** Sanitize arbitrary HTML (editor output) and add ids, TOC, srcsets and code highlighting. */
export async function sanitizeAndEnhance(html: string): Promise<RenderResult> {
  const toc: TocItem[] = [];
  const text = { value: "" };
  const highlighter = await getHighlighter();
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, contentSanitizeSchema)
    .use(rehypeSlug)
    .use(rehypeEnhance(toc, text))
    .use(rehypeShikiFromHighlighter, highlighter, {
      themes: { light: "mono-light", dark: "mono-dark" },
      defaultColor: false,
      fallbackLanguage: "plaintext",
      addLanguageClass: true,
    })
    .use(rehypeStringify)
    .process(html);
  const words = text.value ? text.value.split(" ").length : 0;
  return { html: String(file), text: text.value, toc, readingTime: Math.max(1, Math.round(words / 220)) };
}

export async function renderDocument(json: JSONContent): Promise<RenderResult> {
  return sanitizeAndEnhance(renderContentToHtml(json));
}
