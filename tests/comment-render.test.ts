import { describe, it, expect } from "vitest";
import { renderComment, normalizeCommentDoc } from "@/lib/content/comment-render";

import type { JSONContent } from "@tiptap/core";

type Mark = { type: string; attrs?: Record<string, unknown> };
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const t = (text: string, marks?: Mark[]): JSONContent => ({ type: "text", text, ...(marks ? { marks } : {}) });

describe("comment rendering", () => {
  it("keeps the allowed formatting", async () => {
    const r = await renderComment({
      type: "doc",
      content: [
        p(t("Bold", [{ type: "bold" }]), t(" "), t("it", [{ type: "italic" }]), t(" "), t("x()", [{ type: "code" }])),
        { type: "blockquote", content: [p(t("quoted"))] },
        { type: "bulletList", content: [{ type: "listItem", content: [p(t("one"))] }] },
        { type: "orderedList", content: [{ type: "listItem", content: [p(t("first"))] }] },
      ],
    });
    expect(r.html).toContain("<strong>Bold</strong>");
    expect(r.html).toContain("<em>it</em>");
    expect(r.html).toContain("<code>x()</code>");
    expect(r.html).toContain("<blockquote>");
    expect(r.html).toContain("<ul>");
    expect(r.html).toContain("<ol>");
    expect(r.text).toBe("Bold it x() quoted one first");
  });

  it("highlights code blocks", async () => {
    const r = await renderComment({ type: "doc", content: [{ type: "codeBlock", attrs: { language: "bash" }, content: [t("echo hi")] }] });
    expect(r.html).toContain('class="shiki');
    expect(r.html).toContain("echo");
  });

  it("marks links nofollow/ugc and counts them (including bare URLs)", async () => {
    const r = await renderComment({
      type: "doc",
      content: [p(t("site", [{ type: "link", attrs: { href: "https://example.com" } }]), t(" and https://other.example"))],
    });
    expect(r.html).toMatch(/<a href="https:\/\/example\.com" rel="nofollow ugc noopener">site<\/a>/);
    expect(r.links).toBe(2);
  });

  it("drops dangerous links but keeps their text", async () => {
    const r = await renderComment({ type: "doc", content: [p(t("click", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))] });
    expect(r.html).not.toContain("<a");
    expect(r.html).not.toContain("javascript");
    expect(r.html).toContain("click");
    expect(r.links).toBe(0);
  });

  it("strips nodes and marks outside the comment schema", async () => {
    const r = await renderComment({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [t("Big title")] },
        { type: "image", attrs: { src: "https://evil.example/x.png" } },
        { type: "embed", attrs: { url: "https://youtube.com/watch?v=x" } },
        p(t("<script>alert(1)</script>", [{ type: "textStyle", attrs: { color: "red" } }])),
      ],
    });
    expect(r.html).not.toMatch(/<h1|<img|<iframe|<script|style=/);
    expect(r.html).toContain("<p>Big title</p>");
    expect(r.html).toContain("&#x3C;script>");
  });

  it("merges consecutive code blocks into one", () => {
    const cb = (text: string): JSONContent => ({ type: "codeBlock", attrs: { language: null }, content: [t(text)] });
    const doc = normalizeCommentDoc({ type: "doc", content: [cb("a = 5"), cb("b = 10"), cb("a, b = b, a"), p(t("after"))] });
    expect(doc.content).toHaveLength(2);
    expect(doc.content![0]!.content![0]!.text).toBe("a = 5\nb = 10\na, b = b, a");
  });

  it("normalizes garbage input to an empty paragraph", () => {
    expect(normalizeCommentDoc({ type: "doc", content: [{ type: "nonsense" }] } as never)).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});
