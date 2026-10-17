import { diffWordsWithSpace } from "diff";

/** `pending`: original text the AI hasn't reached yet while it's still writing (shown plainly, not struck out). */
export type DiffSegment = { type: "same" | "add" | "del" | "pending"; text: string };

/** Above this many characters a word diff gets slow to recompute on every chunk; show old and new as blocks instead. */
const MAX_DIFF_CHARS = 24_000;

/** Markdown → readable plain text for the live preview (the final content is parsed properly on the server). */
export function markdownToPlain(md: string): string {
  return md
    .replace(/^```[^\n]*\n?/gm, "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, ""),
    )
    .join("\n")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2")
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Word-level diff of the original and the AI's text. While streaming, the original text after the last point the
 * new text has caught up with is `pending` rather than deleted, so the tail doesn't flash as struck out.
 */
export function diffForPreview(oldText: string, newText: string, streaming: boolean): DiffSegment[] {
  if (!oldText) return newText ? [{ type: "add", text: newText }] : [];
  if (oldText.length + newText.length > MAX_DIFF_CHARS) {
    return [
      { type: streaming ? "pending" : "del", text: oldText },
      { type: "add", text: newText },
    ].filter((s) => s.text) as DiffSegment[];
  }
  const segments: DiffSegment[] = diffWordsWithSpace(oldText, newText).map((c) => ({
    type: c.added ? "add" : c.removed ? "del" : "same",
    text: c.value,
  }));
  if (streaming) {
    for (let i = segments.length - 1; i >= 0 && segments[i]!.type === "del"; i--) segments[i]!.type = "pending";
  }
  return segments;
}
