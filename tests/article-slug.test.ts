import { describe, it, expect, vi } from "vitest";

const articles = [
  { id: "a1", slug: "taken-slug", status: "published", publishedAt: new Date(), title: "A" },
  { id: "a2", slug: "draft-slug", status: "draft", publishedAt: null, title: "B" },
];

vi.mock("@/lib/db", () => ({
  prisma: {
    article: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => articles.find((a) => a.id === where.id) ?? null),
      findFirst: vi.fn(async ({ where }: { where: { slug: string; id?: { not: string } } }) =>
        articles.find((a) => a.slug === where.slug && (!where.id || a.id !== where.id.not)) ?? null,
      ),
      update: vi.fn(async () => ({ id: "a2" })),
    },
    redirect: { upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    tag: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

const { updateArticle, isArticleSlugTaken } = await import("@/lib/admin/content");
const { HttpError } = await import("@/lib/errors");

const base = { title: "B", excerpt: "", contentJson: { type: "doc", content: [{ type: "paragraph" }] }, tags: [], status: "draft" };

describe("article slug uniqueness", () => {
  it("detects slugs used by other articles", async () => {
    expect(await isArticleSlugTaken("taken-slug")).toBe(true);
    expect(await isArticleSlugTaken("taken-slug", "a1")).toBe(false);
    expect(await isArticleSlugTaken("free-slug")).toBe(false);
  });

  it("refuses to save an article with another article's slug (409)", async () => {
    const err = await updateArticle("a2", { ...base, slug: "taken-slug" }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(409);
  });

  it("refuses invalid slugs (400)", async () => {
    const err = await updateArticle("a2", { ...base, slug: "Not Valid" }).catch((e) => e);
    expect(err.status).toBe(400);
  });

  it("saves with a free slug", async () => {
    await expect(updateArticle("a2", { ...base, slug: "brand-new" })).resolves.toEqual({ id: "a2" });
  });
});
