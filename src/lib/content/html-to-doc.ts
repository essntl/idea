import { generateJSON } from "@tiptap/html/server";
import type { JSONContent } from "@tiptap/core";
import { schemaExtensions } from "./extensions";

const extensions = schemaExtensions();

/** Removes artefacts of HTML parsing: empty paragraphs between blocks and trailing newlines in code. */
function tidy(node: JSONContent): JSONContent {
  if (node.type === "codeBlock" && node.content?.length) {
    const last = node.content[node.content.length - 1]!;
    if (last.text) last.text = last.text.replace(/\n+$/, "");
    if (!last.text) node.content.pop();
  }
  if (node.content) {
    node.content = node.content.map(tidy);
    if (node.type === "doc") node.content = node.content.filter((c) => !(c.type === "paragraph" && !c.content?.length));
  }
  return node;
}

/** Parses HTML into editor JSON using the shared schema (server-side, via happy-dom). */
export function htmlToDoc(html: string): JSONContent {
  const doc = tidy(generateJSON(html || "<p></p>", extensions) as JSONContent);
  if (!doc.content?.length) doc.content = [{ type: "paragraph" }];
  return doc;
}
