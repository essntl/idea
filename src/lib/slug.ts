const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g",
};

/** URL slug: lowercase ASCII, words joined by "-", Cyrillic transliterated. */
export function slugify(input: string, maxLength = 80): string {
  const translit = input
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join("");
  return translit
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Paths that must never be used as article slugs (they collide with real routes at the root). */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "blog", "articles", "about", "search", "media", "rss", "rss.xml", "sitemap.xml", "robots.txt",
  "favicon.ico", "_next", "tag", "category", "feed", "login",
]);

/**
 * Returns `base` if free, otherwise `base-2`, `base-3`, … `isTaken` is injected so this stays testable.
 */
export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base) || "untitled";
  let candidate = root;
  for (let i = 2; RESERVED_SLUGS.has(candidate) || (await isTaken(candidate)); i++) {
    candidate = `${root}-${i}`;
  }
  return candidate;
}

export function validateSlug(slug: string): string | null {
  if (!slug) return "Slug is required";
  if (slug.length > 120) return "Slug is too long";
  if (!SLUG_PATTERN.test(slug)) return "Use lowercase letters, numbers and single dashes";
  if (RESERVED_SLUGS.has(slug)) return "This slug is reserved";
  return null;
}
