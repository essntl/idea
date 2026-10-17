import { describe, it, expect } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { plainOf, protect, restore, withLabels, type Protected } from "@/lib/content/ai-protect";

const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const image: JSONContent = { type: "image", attrs: { src: "/media/a.webp", caption: "Sketch", size: 50 } };
const embed: JSONContent = { type: "embed", attrs: { url: "https://youtube.com/watch?v=x" } };

describe("protecting non-text content from AI edits", () => {
  it("swaps illustrations and embeds for markers and labels them in the preview text", () => {
    const kept: Protected = { nodes: [], labels: [] };
    const blocks = protect([p("Intro"), image, p("Middle"), embed], kept);
    expect(blocks.map((b) => b.content?.[0]?.text ?? b.type)).toEqual(["Intro", "⟦1⟧", "Middle", "⟦2⟧"]);
    expect(plainOf(blocks, kept)).toBe("Intro\n\n[Image]\n\nMiddle\n\n[Embed]");
    expect(withLabels("New intro\n\n⟦1⟧", kept)).toBe("New intro\n\n[Image]");
  });

  it("restores the original nodes, attributes included, where the AI kept the markers", () => {
    const kept: Protected = { nodes: [], labels: [] };
    protect([p("a"), image, p("b"), embed], kept);
    const out = restore([p("A!"), p("⟦1⟧"), p("B!"), p("⟦2⟧")], kept);
    expect(out[1]).toEqual(image);
    expect(out[3]).toEqual(embed);
  });

  it("never loses content the AI dropped or duplicated", () => {
    const kept: Protected = { nodes: [], labels: [] };
    protect([image, embed], kept);
    const out = restore([p("⟦1⟧"), p("Text"), p("⟦1⟧")], kept);
    expect(out.filter((n) => n.type === "image")).toHaveLength(1);
    expect(out.at(-1)).toEqual(embed);
  });
});
