import { describe, it, expect } from "vitest";
import { applyDraft, NO_EXTRA_FIELDS, type DraftFields } from "@/lib/admin/apply-draft";
import { draftSchemas } from "@/lib/admin/content";

const live: DraftFields = {
  ...NO_EXTRA_FIELDS,
  title: "Live title",
  description: "Live excerpt",
  contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "live" }] }] },
  tags: ["a"],
  publishedAt: "2024-01-01T00:00:00.000Z",
  slug: "live-slug",
  categoryId: "cat1",
  previewImageId: "img1",
  seoTitle: "",
  seoDescription: "",
};

describe("pending drafts", () => {
  it("returns the live version when there is no draft", () => {
    expect(applyDraft(live, null)).toEqual(live);
  });

  it("overlays draft fields, mapping an article excerpt to the description", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "draft" }] }] };
    const r = applyDraft(live, { title: "Draft title", excerpt: "Draft excerpt", contentJson: doc, tags: ["b", "c"], previewImageId: null });
    expect(r.title).toBe("Draft title");
    expect(r.description).toBe("Draft excerpt");
    expect(r.contentJson).toEqual(doc);
    expect(r.tags).toEqual(["b", "c"]);
    expect(r.previewImageId).toBeNull();
    // Untouched fields keep their live values.
    expect(r.slug).toBe("live-slug");
    expect(r.categoryId).toBe("cat1");
  });

  it("ignores a corrupt content document", () => {
    expect(applyDraft(live, { contentJson: { type: "nonsense" } }).contentJson).toEqual(live.contentJson);
  });

  it("accepts half-finished work that publishing would reject", () => {
    const parsed = draftSchemas.article.parse({
      title: "",
      slug: "Not A Valid Slug Yet",
      excerpt: "",
      contentJson: { type: "doc", content: [] },
      tags: [],
      publishedAt: null,
    });
    expect(parsed.slug).toBe("Not A Valid Slug Yet");
  });

  it("overlays project fields and maps a project summary to the description", () => {
    const project: DraftFields = { ...live, phase: "building", repoUrl: "https://github.com/a/b", stack: ["Go"], featured: false };
    const r = applyDraft(project, { summary: "New summary", phase: "live", siteUrl: "https://b.example", stack: ["Go", "Postgres"], featured: true });
    expect(r.description).toBe("New summary");
    expect(r.phase).toBe("live");
    expect(r.siteUrl).toBe("https://b.example");
    expect(r.repoUrl).toBe("https://github.com/a/b");
    expect(r.stack).toEqual(["Go", "Postgres"]);
    expect(r.featured).toBe(true);
  });

  it("autosaves half-typed project links (they're checked on publish)", () => {
    const parsed = draftSchemas.project.parse({
      title: "", slug: "x", summary: "", contentJson: { type: "doc", content: [] }, phase: "planning", repoUrl: "github.com/ess", siteUrl: "", packageUrl: "",
    });
    expect(parsed.repoUrl).toBe("github.com/ess");
  });

  it("never stores a status in a draft (publishing is explicit)", () => {
    const parsed = draftSchemas.blog.parse({ title: "x", contentJson: { type: "doc", content: [] }, status: "published" }) as Record<string, unknown>;
    expect(parsed.status).toBeUndefined();
  });
});
