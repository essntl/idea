import { describe, it, expect } from "vitest";
import { sanitizeAndEnhance, renderDocument } from "@/lib/content/pipeline";

describe("content sanitizer", () => {
  it("removes scripts, event handlers, javascript: URLs and foreign iframes", async () => {
    const { html } = await sanitizeAndEnhance(
      '<p onclick="x()">Hi<script>alert(1)</script><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p><iframe src="https://evil.example"></iframe>',
    );
    expect(html).not.toMatch(/script|onclick|onerror|javascript:|evil\.example/);
  });

  it("keeps YouTube embeds and adds heading ids", async () => {
    const { html } = await renderDocument({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Intro" }] },
        { type: "embed", attrs: { url: "https://youtu.be/dQw4w9WgXcQ" } },
      ],
    });
    expect(html).toContain('id="intro"');
    expect(html).toContain("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("builds a table of contents and reading time", async () => {
    const r = await renderDocument({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "One" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Two" }] },
        { type: "paragraph", content: [{ type: "text", text: "word ".repeat(500) }] },
      ],
    });
    expect(r.toc).toEqual([
      { id: "one", text: "One", level: 2 },
      { id: "two", text: "Two", level: 3 },
    ]);
    expect(r.readingTime).toBe(2);
  });
});
