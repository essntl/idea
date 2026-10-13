/**
 * The document schema shared by the browser editor and the server-side renderer.
 * Nothing in here may depend on React or the DOM so it can run in Node.
 */
import { Node, mergeAttributes, type AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";

export const IMAGE_SIZES = [25, 50, 75, 100] as const;
export const IMAGE_ALIGNS = ["left", "center", "right"] as const;
export type ImageAlign = (typeof IMAGE_ALIGNS)[number];

/** Grayscale only — the site is strictly black and white. */
export const TEXT_COLORS = [
  { label: "Default", value: null },
  { label: "Gray", value: "#6b7280" },
  { label: "Light gray", value: "#9ca3af" },
] as const;

function intAttr(value: string | null | undefined, fallback: number | null = null) {
  const n = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Block image with caption, size (percent of the column) and alignment.
 * Rendered as <figure><img><figcaption></figure>.
 */
export const Figure = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
      size: { default: 100 },
      align: { default: "center" },
      width: { default: null },
      height: { default: null },
      /** Set while an upload is in progress or when a local reference could not be resolved. */
      missing: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el) => {
          const img = (el as HTMLElement).querySelector("img");
          if (!img) return false;
          const cap = (el as HTMLElement).querySelector("figcaption");
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") ?? "",
            caption: cap?.textContent?.trim() ?? "",
            size: intAttr((el as HTMLElement).getAttribute("data-size"), 100),
            align: (el as HTMLElement).getAttribute("data-align") ?? "center",
            width: intAttr(img.getAttribute("width")),
            height: intAttr(img.getAttribute("height")),
            missing: (el as HTMLElement).getAttribute("data-missing") === "true",
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("src"),
          alt: (el as HTMLElement).getAttribute("alt") ?? "",
          caption: (el as HTMLElement).getAttribute("title") ?? "",
          width: intAttr((el as HTMLElement).getAttribute("width")),
          height: intAttr((el as HTMLElement).getAttribute("height")),
        }),
      },
    ];
  },

  renderHTML({ node }) {
    const { src, alt, caption, size, align, width, height, missing } = node.attrs;
    const img = [
      "img",
      {
        src,
        alt: alt ?? "",
        ...(width ? { width: String(width) } : {}),
        ...(height ? { height: String(height) } : {}),
        loading: "lazy",
        decoding: "async",
      },
    ] as const;
    const attrs = {
      "data-size": String(size ?? 100),
      "data-align": String(align ?? "center"),
      ...(missing ? { "data-missing": "true" } : {}),
    };
    return caption ? ["figure", attrs, img, ["figcaption", {}, caption]] : ["figure", attrs, img];
  },
});

/** Bordered note block. Optional emoji/icon is kept for imported Ghost callouts. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "paragraph+",
  defining: true,

  addAttributes() {
    return { emoji: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "aside.callout",
        contentElement: ".callout-body",
        getAttrs: (el) => ({ emoji: (el as HTMLElement).getAttribute("data-emoji") ?? "" }),
      },
    ];
  },

  renderHTML({ node }) {
    const emoji = node.attrs.emoji as string;
    return [
      "aside",
      mergeAttributes({ class: "callout" }, emoji ? { "data-emoji": emoji } : {}),
      ["div", { class: "callout-body" }, 0],
    ];
  },
});

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
      return m?.[1] ?? null;
    }
  } catch {
    // not a URL
  }
  return null;
}

/** YouTube video or a link "bookmark" card. */
export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-embed]",
        getAttrs: (el) => ({
          url: (el as HTMLElement).getAttribute("data-url") ?? "",
          title: (el as HTMLElement).querySelector(".bookmark-title")?.textContent ?? "",
          description: (el as HTMLElement).querySelector(".bookmark-description")?.textContent ?? "",
        }),
      },
    ];
  },

  renderHTML({ node }) {
    const url = String(node.attrs.url ?? "");
    const id = youtubeId(url);
    if (id) {
      return [
        "div",
        { "data-embed": "youtube", "data-url": url, class: "embed-video" },
        [
          "iframe",
          {
            src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`,
            title: node.attrs.title || "YouTube video",
            loading: "lazy",
            allow: "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen",
            allowfullscreen: "true",
          },
        ],
      ];
    }
    let host = url;
    try {
      host = new URL(url).hostname;
    } catch {
      // keep raw value
    }
    return [
      "div",
      { "data-embed": "link", "data-url": url, class: "bookmark" },
      [
        "a",
        { href: url },
        ["span", { class: "bookmark-title" }, node.attrs.title || host],
        ...(node.attrs.description ? [["span", { class: "bookmark-description" }, node.attrs.description]] : []),
        ["span", { class: "bookmark-host" }, host],
      ],
    ];
  },
});

export type SchemaOverrides = { image?: AnyExtension; embed?: AnyExtension; codeBlock?: AnyExtension };

/**
 * Extensions that define the document schema. The editor passes overrides that add React node views
 * to the same node types, so documents stay identical between browser and server.
 */
export function schemaExtensions(overrides: SchemaOverrides = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      codeBlock: overrides.codeBlock ? false : {},
      dropcursor: { color: "currentColor", width: 2 },
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: null, rel: null },
        protocols: ["http", "https", "mailto"],
      },
      // Undo history and cursors are editor-only; harmless on the server.
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    TextStyle,
    Color,
    Highlight,
    overrides.image ?? Figure,
    Callout,
    overrides.embed ?? Embed,
    ...(overrides.codeBlock ? [overrides.codeBlock] : []),
  ];
}

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
