import { describe, it, expect } from "vitest";
import { parseMarkdown, exportMarkdown, normalizeFrontMatter } from "@/lib/markdown";

const SAMPLE = [
  "---",
  "title: Front Matter Title",
  "description: Short summary",
  "slug: custom-slug",
  'tags: [linux, "home lab"]',
  "category: Guides",
  "date: 2024-03-01",
  "image: ./cover.png",
  "---",
  "",
  "Intro with **bold** and `code`.",
  "",
  "## Section",
  "",
  "- [x] done",
  "- [ ] todo",
  "",
  "```bash",
  "echo hi",
  "```",
  "",
  '![Diagram](./img/diagram.png "Caption here")',
  "![Known](known.png)",
  "![Remote](https://example.com/a.png)",
  "",
].join("\n");

describe("markdown import", () => {
  const known = (ref: string) => (ref.endsWith("known.png") ? "/media/2024/01/known.webp" : null);
  const r = parseMarkdown(SAMPLE, known);

  it("reads YAML front matter", () => {
    expect(r.title).toBe("Front Matter Title");
    expect(r.frontMatter).toMatchObject({
      description: "Short summary",
      slug: "custom-slug",
      tags: ["linux", "home lab"],
      category: "Guides",
      date: "2024-03-01T00:00:00.000Z",
      image: "./cover.png",
    });
  });

  it("converts markdown to editor nodes", () => {
    const types = r.doc.content!.map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(["paragraph", "heading", "taskList", "codeBlock", "image"]));
    const code = r.doc.content!.find((n) => n.type === "codeBlock")!;
    expect(code.attrs?.language).toBe("bash");
    expect(code.content?.[0]?.text).toBe("echo hi");
    const task = r.doc.content!.find((n) => n.type === "taskList")!;
    expect(task.content!.map((i) => i.attrs?.checked)).toEqual([true, false]);
  });

  it("flags local images that cannot be resolved and resolves known ones", () => {
    expect(r.unresolvedImages).toEqual(["./img/diagram.png"]);
    const images = r.doc.content!.filter((n) => n.type === "image");
    expect(images[0]!.attrs).toMatchObject({ src: "./img/diagram.png", missing: true, caption: "Caption here", alt: "Diagram" });
    expect(images[1]!.attrs).toMatchObject({ src: "/media/2024/01/known.webp", missing: false });
    expect(images[2]!.attrs).toMatchObject({ src: "https://example.com/a.png", missing: false });
  });

  it("uses a leading H1 as the title when there is no front matter", () => {
    const p = parseMarkdown("# My Title\n\nBody text");
    expect(p.title).toBe("My Title");
    expect(p.doc.content![0]!.type).toBe("paragraph");
  });

  it("accepts comma-separated tags and alternative keys", () => {
    expect(normalizeFrontMatter({ tags: "a, b ,c", excerpt: "x", categories: ["C1", "C2"] })).toMatchObject({
      tags: ["a", "b", "c"],
      description: "x",
      category: "C1",
    });
  });
});

describe("markdown export", () => {
  it("round-trips content and front matter", () => {
    const { doc } = parseMarkdown(SAMPLE);
    const md = exportMarkdown(doc, { title: "T", slug: "s", tags: ["a"], category: "C", date: "2024-03-01T00:00:00.000Z" });
    expect(md).toMatch(/^---\ntitle: T\n/);
    expect(md).toContain("slug: s");
    expect(md).toContain("**bold**");
    expect(md).toContain("```bash\necho hi\n```");
    expect(md).toContain("[x] done");
    expect(md).toContain('![Diagram](./img/diagram.png "Caption here")');
    const again = parseMarkdown(md);
    expect(again.title).toBe("T");
    expect(again.doc.content!.some((n) => n.type === "codeBlock")).toBe(true);
  });
});
