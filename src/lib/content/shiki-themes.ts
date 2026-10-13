import type { ThemeRegistration } from "shiki";

/**
 * Monochrome code themes: hierarchy through weight, style and gray levels only.
 */
function mono(name: string, type: "light" | "dark", c: { fg: string; muted: string; strong: string; bg: string }) {
  return {
    name,
    type,
    colors: { "editor.background": c.bg, "editor.foreground": c.fg },
    tokenColors: [
      { settings: { foreground: c.fg } },
      { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: c.muted, fontStyle: "italic" } },
      {
        scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new"],
        settings: { foreground: c.strong, fontStyle: "bold" },
      },
      { scope: ["keyword.operator", "keyword.operator.assignment"], settings: { foreground: c.fg, fontStyle: "" } },
      { scope: ["string", "string.quoted", "string.template"], settings: { foreground: c.muted } },
      { scope: ["constant.numeric", "constant.language"], settings: { foreground: c.strong } },
      { scope: ["entity.name.function", "support.function"], settings: { foreground: c.strong } },
      { scope: ["entity.name.type", "entity.name.class", "support.type"], settings: { foreground: c.strong, fontStyle: "italic" } },
      { scope: ["entity.name.tag", "markup.heading"], settings: { foreground: c.strong, fontStyle: "bold" } },
      { scope: ["punctuation", "meta.brace"], settings: { foreground: c.muted } },
      { scope: ["markup.deleted"], settings: { foreground: c.muted, fontStyle: "strikethrough" } },
      { scope: ["markup.inserted"], settings: { foreground: c.strong, fontStyle: "bold" } },
    ],
  } satisfies ThemeRegistration;
}

export const monoLight = mono("mono-light", "light", { fg: "#1f1f1f", muted: "#6b6b6b", strong: "#000000", bg: "#f6f6f6" });
export const monoDark = mono("mono-dark", "dark", { fg: "#e6e6e6", muted: "#9a9a9a", strong: "#ffffff", bg: "#141414" });
