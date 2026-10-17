import { describe, it, expect } from "vitest";
import { diffForPreview, markdownToPlain } from "@/lib/content/word-diff";

describe("AI live diff", () => {
  it("turns markdown into readable text for the preview", () => {
    expect(markdownToPlain("## Title\n\n- **Bold** item with `code`\n- [a link](https://x.dev)\n\n> quote")).toBe("Title\n\nBold item with code\na link\n\nquote");
  });

  it("marks removed and added words", () => {
    const segs = diffForPreview("This are a test.", "This is a test.", false);
    expect(segs.filter((s) => s.type === "del").map((s) => s.text.trim())).toEqual(["are"]);
    expect(segs.filter((s) => s.type === "add").map((s) => s.text.trim())).toEqual(["is"]);
  });

  it("keeps the not-yet-rewritten tail pending while streaming, struck out once finished", () => {
    const old = "One two three four five";
    const streaming = diffForPreview(old, "One two", true);
    expect(streaming.at(-1)).toEqual({ type: "pending", text: " three four five" });
    expect(diffForPreview(old, "One two", false).at(-1)!.type).toBe("del");
  });

  it("shows everything as new for an empty original (continue writing)", () => {
    expect(diffForPreview("", "Fresh text", true)).toEqual([{ type: "add", text: "Fresh text" }]);
  });
});
