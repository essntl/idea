/**
 * Comment rendering: editor JSON → static HTML → strict sanitize → Shiki for code blocks.
 * Pure module (no Next.js imports) so it is unit-testable.
 */
import type { JSONContent } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";
import { commentExtensions } from "./comment-schema";
import { getHighlighter, plainText } from "./pipeline";

const extensions = commentExtensions();

/** Only what the comment editor can produce. Nothing else survives. */
export const commentSanitizeSchema: SanitizeSchema = {
  tagNames: ["p", "br", "strong", "em", "code", "a", "blockquote", "ul", "ol", "li", "pre"],
  attributes: {
    a: ["href"],
    code: [["className", /^language-[\w+#-]+$/]],
    ol: ["start"],
  },
  protocols: { href: ["http", "https", "mailto"] },
  strip: ["script", "style"],
  clobberPrefix: "",
};

export type RenderedComment = { html: string; text: string; links: number };

const URL_RE = /(https?:\/\/|www\.)\S+/gi;

function rehypeCommentLinks(out: { links: number; text: string }) {
  return () => (tree: Root) => {
    out.text = plainText(tree);
    let links = 0;
    // Links whose URL was removed by the sanitizer become plain text.
    visit(tree, "element", (node: Element, i, parent) => {
      if (node.tagName === "a" && !node.properties.href && parent && i !== undefined) {
        parent.children.splice(i, 1, ...node.children);
        return i;
      }
    });
    visit(tree, (node, _i, parent) => {
      if (node.type === "element" && node.tagName === "a") {
        links++;
        node.properties = { ...node.properties, rel: ["nofollow", "ugc", "noopener"] };
      } else if (node.type === "text" && !(parent && parent.type === "element" && (parent as Element).tagName === "a")) {
        links += (node.value.match(URL_RE) ?? []).length;
      }
    });
    out.links = links;
  };
}

const INLINE = new Set(["text", "hardBreak"]);
const MARKS = new Set(["bold", "italic", "code", "link"]);

function textOf(n: JSONContent): string {
  return n.text ?? (n.content ?? []).map(textOf).join(" ");
}

/**
 * Normalizes untrusted editor JSON to the comment schema: unknown blocks become paragraphs with their text,
 * unknown inline nodes and marks are dropped. Keeps the renderer from ever seeing unexpected types.
 */
export function normalizeCommentDoc(json: JSONContent): JSONContent {
  const inline = (nodes: JSONContent[] = []): JSONContent[] =>
    nodes
      .filter((n) => INLINE.has(n.type ?? "") && (n.type !== "text" || typeof n.text === "string"))
      .map((n) =>
        n.type === "text"
          ? { type: "text", text: n.text!.slice(0, 20_000), ...(n.marks ? { marks: n.marks.filter((m) => MARKS.has(m.type)).map((m) => (m.type === "link" ? { type: "link", attrs: { href: String(m.attrs?.href ?? "") } } : { type: m.type })) } : {}) }
          : { type: "hardBreak" },
      );
  const block = (n: JSONContent): JSONContent | null => {
    switch (n.type) {
      case "paragraph":
        return { type: "paragraph", content: inline(n.content) };
      case "codeBlock":
        return { type: "codeBlock", attrs: { language: typeof n.attrs?.language === "string" ? n.attrs.language.slice(0, 30) : null }, content: (() => {
            const text = inline(n.content).filter((c) => c.type === "text").map((c) => c.text).join("");
            return text ? [{ type: "text", text }] : [];
          })() };
      case "blockquote":
        return { type: "blockquote", content: blocks(n.content) };
      case "bulletList":
      case "orderedList":
        return { type: n.type, ...(n.type === "orderedList" && Number.isInteger(n.attrs?.start) ? { attrs: { start: n.attrs!.start } } : {}), content: (n.content ?? []).filter((li) => li.type === "listItem").map((li) => ({ type: "listItem", content: blocks(li.content) })) };
      default: {
        const text = textOf(n).trim();
        return text ? { type: "paragraph", content: [{ type: "text", text }] } : null;
      }
    }
  };
  const blocks = (nodes: JSONContent[] = []): JSONContent[] => {
    const out: JSONContent[] = [];
    for (const b of nodes.map(block)) {
      if (!b) continue;
      // Consecutive code blocks (e.g. each pasted line converted separately) become one block.
      const prev = out[out.length - 1];
      if (b.type === "codeBlock" && prev?.type === "codeBlock") {
        const text = [prev.content?.[0]?.text ?? "", b.content?.[0]?.text ?? ""].join("\n");
        prev.content = [{ type: "text", text }];
        continue;
      }
      out.push(b);
    }
    return out.length ? out : [{ type: "paragraph" }];
  };
  return { type: "doc", content: blocks(json?.content) };
}

export function commentDocToHtml(json: JSONContent): string {
  if (!json || json.type !== "doc") return "";
  return renderToHTMLString({ extensions, content: normalizeCommentDoc(json) });
}

/** Renders a comment document. `text` is the plain-text version used for limits and the admin. */
export async function renderComment(json: JSONContent): Promise<RenderedComment> {
  const out = { links: 0, text: "" };
  const highlighter = await getHighlighter();
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, commentSanitizeSchema)
    .use(rehypeCommentLinks(out))
    .use(rehypeShikiFromHighlighter, highlighter, {
      themes: { light: "mono-light", dark: "mono-dark" },
      defaultColor: false,
      fallbackLanguage: "plaintext",
    })
    .use(rehypeStringify)
    .process(commentDocToHtml(json));
  return { html: String(file), text: out.text, links: out.links };
}
