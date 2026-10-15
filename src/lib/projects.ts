/** Project constants shared by the admin editor and public pages (safe for client components). */

export const PROJECT_PHASES = ["planning", "building", "live", "paused", "archived"] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export const PHASE_META: Record<ProjectPhase, { label: string; hint: string }> = {
  building: { label: "Building", hint: "Actively in development" },
  live: { label: "Live", hint: "Released and in use" },
  planning: { label: "Planning", hint: "Ideas, research and sketches" },
  paused: { label: "Paused", hint: "On hold for now" },
  archived: { label: "Archived", hint: "Finished or no longer worked on" },
};

/** Order of the phase filter and of projects within the same "featured" group. */
export const PHASE_ORDER: ProjectPhase[] = ["building", "live", "planning", "paused", "archived"];

const PACKAGE_HOSTS: [RegExp, string][] = [
  [/(^|\.)npmjs\.(com|org)$/, "npm"],
  [/^ghcr\.io$/, "GHCR"],
  [/^github\.com$/, "GitHub Packages"],
  [/(^|\.)pypi\.org$/, "PyPI"],
  [/^hub\.docker\.com$/, "Docker Hub"],
  [/^crates\.io$/, "crates.io"],
  [/(^|\.)nuget\.org$/, "NuGet"],
  [/^pkg\.go\.dev$/, "Go"],
  [/(^|\.)rubygems\.org$/, "RubyGems"],
  [/^marketplace\.visualstudio\.com$/, "VS Marketplace"],
  [/^addons\.mozilla\.org$/, "Firefox Add-ons"],
  [/^chromewebstore\.google\.com$/, "Chrome Web Store"],
  [/^apps\.apple\.com$/, "App Store"],
  [/^play\.google\.com$/, "Google Play"],
];

/** Short, recognisable name for a package/registry link ("npm", "GHCR", …), falling back to the host name. */
export function packageLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "github.com" && /\/pkgs\/container\//.test(url)) return "GHCR";
    return PACKAGE_HOSTS.find(([re]) => re.test(host))?.[1] ?? host;
  } catch {
    return "Package";
  }
}

/** "https://artemk.dev/" → "artemk.dev". */
export function displayHost(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}
