import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug, validateSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and dashes words", () => {
    expect(slugify("How Does a PC Work?")).toBe("how-does-a-pc-work");
  });
  it("strips accents and transliterates Cyrillic", () => {
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
    expect(slugify("Привет мир")).toBe("privet-mir");
  });
  it("collapses separators and trims", () => {
    expect(slugify("  --a__b  c-- ")).toBe("a-b-c");
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when free", async () => {
    expect(await uniqueSlug("Hello", async () => false)).toBe("hello");
  });
  it("appends a counter until the slug is unique", async () => {
    const taken = new Set(["hello", "hello-2"]);
    expect(await uniqueSlug("Hello", async (s) => taken.has(s))).toBe("hello-3");
  });
  it("never returns a reserved slug", async () => {
    expect(await uniqueSlug("admin", async () => false)).toBe("admin-2");
  });
  it("falls back to 'untitled' for empty input", async () => {
    expect(await uniqueSlug("???", async () => false)).toBe("untitled");
  });
});

describe("validateSlug", () => {
  it("accepts valid slugs", () => expect(validateSlug("how-does-a-pc-work")).toBeNull());
  it("rejects bad characters", () => expect(validateSlug("Bad Slug")).toMatch(/lowercase/));
  it("rejects double dashes", () => expect(validateSlug("a--b")).not.toBeNull());
  it("rejects reserved paths", () => expect(validateSlug("rss.xml")).not.toBeNull());
});
