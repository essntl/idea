import { describe, it, expect, beforeAll } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { extractJson } from "@/lib/ai/client";
import { unwrapFence } from "@/lib/ai/editing";
import { cleanRepoDoc, detectStack, guessPhase } from "@/lib/admin/project-from-repo";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET ??= "test-secret-0123456789abcdef";
});

describe("secret encryption", () => {
  it("round-trips and never stores the plain value", () => {
    const enc = encryptSecret("sk-ant-test-key-123");
    expect(enc).not.toContain("sk-ant");
    expect(decryptSecret(enc)).toBe("sk-ant-test-key-123");
  });

  it("returns null for tampered or foreign values", () => {
    const enc = encryptSecret("abc");
    const parts = enc.split(":");
    parts[3] = Buffer.from("xyz").toString("base64");
    expect(decryptSecret(parts.join(":"))).toBeNull();
    expect(decryptSecret("not-encrypted")).toBeNull();
  });
});

describe("AI output handling", () => {
  it("finds the JSON object in a chatty answer", () => {
    expect(extractJson('Sure! ```json\n{"title":"x","n":1}\n``` Hope that helps')).toEqual({ title: "x", n: 1 });
    expect(() => extractJson("no json here")).toThrow();
  });

  it("unwraps a fence around the whole answer only", () => {
    expect(unwrapFence("```markdown\nHello **world**\n```")).toBe("Hello **world**");
    expect(unwrapFence("Text\n\n```js\nx()\n```")).toBe("Text\n\n```js\nx()\n```");
  });
});

describe("project from a repository", () => {
  it("detects frameworks and main languages, skipping markup noise", () => {
    const stack = detectStack({
      languages: ["TypeScript", "CSS", "Shell", "Python"],
      manifests: { "package.json": '{"dependencies":{"next":"16","react":"19","@prisma/client":"7"}}', "docker-compose.yml": "image: postgres:16" },
      files: ["Dockerfile", "package.json", "src/"],
    });
    expect(stack).toEqual(["Next.js", "React", "Prisma", "TypeScript", "Python", "Docker", "PostgreSQL"]);
  });

  it("guesses the status from the repository's activity", () => {
    const now = Date.parse("2026-10-15T00:00:00Z");
    expect(guessPhase({ archived: true, hasRelease: true, homepage: null, pushedAt: null }, now)).toBe("archived");
    expect(guessPhase({ archived: false, hasRelease: false, homepage: "https://x.dev", pushedAt: null }, now)).toBe("live");
    expect(guessPhase({ archived: false, hasRelease: false, homepage: null, pushedAt: "2026-10-01T00:00:00Z" }, now)).toBe("building");
    expect(guessPhase({ archived: false, hasRelease: false, homepage: null, pushedAt: "2025-01-01T00:00:00Z" }, now)).toBe("paused");
  });

  it("drops badges and empty paragraphs and makes relative links absolute", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "https://img.shields.io/badge/license-MIT-blue.svg" } },
        { type: "image", attrs: { src: "https://github.com/a/b/actions/workflows/ci.yml/badge.svg" } },
        { type: "paragraph", content: [] },
        { type: "paragraph", content: [{ type: "text", text: "See the docs", marks: [{ type: "link", attrs: { href: "docs/setup.md" } }] }] },
        { type: "image", attrs: { src: "https://raw.githubusercontent.com/a/b/main/screenshot.png" } },
      ],
    };
    const out = cleanRepoDoc(doc, "https://github.com/a/b", "main");
    expect(out.content).toHaveLength(2);
    expect(out.content![0]!.content![0]!.marks![0]!.attrs!.href).toBe("https://github.com/a/b/blob/main/docs/setup.md");
    expect(out.content![1]!.attrs!.src).toContain("screenshot.png");
  });
});
