/**
 * Rich-text schema for visitor comments: paragraphs, bold, italic, inline code, links, quotes,
 * bullet/numbered lists and code blocks. No headings, images, embeds or colours.
 * Shared by the browser comment editor and the server renderer.
 */
import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

export function commentExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { target: null, rel: "nofollow ugc noopener" },
      },
    }),
  ];
}

export const COMMENT_DOC_MAX_BYTES = 50_000;
