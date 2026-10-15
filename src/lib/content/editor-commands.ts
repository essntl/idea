import type { Editor } from "@tiptap/core";

/**
 * Toggles a code block. When several lines (paragraphs/headings) are selected, they become ONE code block
 * joined by newlines — the default command would turn every line into its own block.
 */
export function toggleCodeBlock(editor: Editor): boolean {
  if (editor.isActive("codeBlock")) return editor.chain().focus().toggleCodeBlock().run();
  const { state } = editor;
  const { $from, $to } = state.selection;
  const range = $from.blockRange($to);
  if (!range || range.endIndex - range.startIndex < 2) return editor.chain().focus().toggleCodeBlock().run();

  const lines: string[] = [];
  for (let i = range.startIndex; i < range.endIndex; i++) {
    const child = range.parent.child(i);
    if (!child.isTextblock) return editor.chain().focus().toggleCodeBlock().run(); // lists, images…: keep default
    lines.push(child.textContent);
  }
  const text = lines.join("\n");
  return editor
    .chain()
    .focus()
    .insertContentAt({ from: range.start, to: range.end }, { type: "codeBlock", content: text ? [{ type: "text", text }] : [] })
    .run();
}
