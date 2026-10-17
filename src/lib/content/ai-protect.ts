import type { JSONContent } from "@tiptap/core";

/**
 * Content the AI must leave alone (illustrations, embeds, tables, code, dividers) is swapped for a marker like
 * ⟦1⟧ before it's sent, and swapped back afterwards. The AI only ever sees and rewrites text, so nothing else
 * can be lost or mangled.
 */
const PROTECTED: Record<string, string> = { image: "Image", embed: "Embed", table: "Table", horizontalRule: "Divider", codeBlock: "Code" };
const MARKER = /^\s*⟦(\d+)⟧\s*$/;

export type Protected = { nodes: JSONContent[]; labels: string[] };

export function protect(blocks: JSONContent[], kept: Protected): JSONContent[] {
  return blocks.map((n) => {
    const label = n.type ? PROTECTED[n.type] : undefined;
    if (!label) return n;
    kept.nodes.push(n);
    kept.labels.push(`[${label}]`);
    return { type: "paragraph", content: [{ type: "text", text: `⟦${kept.nodes.length}⟧` }] };
  });
}

/** Puts the protected content back; anything the AI dropped is added at the end rather than lost. */
export function restore(blocks: JSONContent[], kept: Protected): JSONContent[] {
  const used = new Set<number>();
  const out = blocks.map((n) => {
    const m = n.type === "paragraph" && n.content?.length === 1 ? n.content[0]!.text?.match(MARKER) : null;
    const i = m ? Number(m[1]) - 1 : -1;
    if (i < 0 || i >= kept.nodes.length || used.has(i)) return n;
    used.add(i);
    return kept.nodes[i]!;
  });
  return [...out, ...kept.nodes.filter((_, i) => !used.has(i))];
}

/** Readable text of the original for the diff (protected content shows as a label on both sides). */
export function plainOf(blocks: JSONContent[], kept: Protected): string {
  const text = (n: JSONContent): string => n.text ?? (n.type === "hardBreak" ? "\n" : (n.content ?? []).map(text).join(n.type === "listItem" || n.type === "bulletList" || n.type === "orderedList" || n.type === "taskList" ? "\n" : ""));
  return blocks
    .map((n) => {
      const m = n.type === "paragraph" && n.content?.length === 1 ? n.content[0]!.text?.match(MARKER) : null;
      return m ? (kept.labels[Number(m[1]) - 1] ?? "") : text(n);
    })
    .join("\n\n");
}

export const withLabels = (plain: string, kept: Protected) => plain.replace(/⟦(\d+)⟧/g, (_, n: string) => kept.labels[Number(n) - 1] ?? "");
