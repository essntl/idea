import { describe, it, expect } from "vitest";
import { computeStreaks, githubUsername, groupPushes, languageShares, parseContributionsHtml, parseGithubRepo, type ContributionDay } from "@/lib/github";
import { normalizeUrl } from "@/lib/admin/content";
import { packageLabel } from "@/lib/projects";
import { toWeeks } from "@/components/site/projects/contribution-graph";

const day = (date: string, count: number): ContributionDay => ({ date, count, level: count ? 1 : 0 });

describe("GitHub URLs", () => {
  it("extracts the username from a profile or repository link", () => {
    expect(githubUsername("https://github.com/essntl")).toBe("essntl");
    expect(githubUsername("https://www.github.com/essntl/idea/")).toBe("essntl");
    expect(githubUsername("https://gitlab.com/essntl")).toBeNull();
    expect(githubUsername("")).toBeNull();
  });

  it("parses owner/repo and ignores .git and deeper paths", () => {
    expect(parseGithubRepo("https://github.com/essntl/idea")).toEqual({ owner: "essntl", repo: "idea" });
    expect(parseGithubRepo("https://github.com/essntl/idea.git")).toEqual({ owner: "essntl", repo: "idea" });
    expect(parseGithubRepo("https://github.com/essntl/idea/tree/main/src")).toEqual({ owner: "essntl", repo: "idea" });
    expect(parseGithubRepo("https://github.com/essntl")).toBeNull();
    expect(parseGithubRepo("https://example.com/a/b")).toBeNull();
  });
});

describe("contribution streaks", () => {
  it("counts the current streak back from today, and the longest run", () => {
    const days = [day("2026-10-01", 1), day("2026-10-02", 2), day("2026-10-03", 3), day("2026-10-04", 0), day("2026-10-05", 1), day("2026-10-06", 4)];
    expect(computeStreaks(days)).toEqual({ current: 2, longest: 3 });
  });

  it("doesn't break the current streak when today has no contributions yet", () => {
    const days = [day("2026-10-04", 1), day("2026-10-05", 1), day("2026-10-06", 0)];
    expect(computeStreaks(days).current).toBe(2);
  });

  it("is zero after a missed day", () => {
    const days = [day("2026-10-04", 1), day("2026-10-05", 0), day("2026-10-06", 0)];
    expect(computeStreaks(days)).toEqual({ current: 0, longest: 1 });
    expect(computeStreaks([])).toEqual({ current: 0, longest: 0 });
  });
});

describe("contributions page parser", () => {
  it("reads dates, levels and counts from the public calendar", () => {
    const html = `
      <td tabindex="0" data-ix="0" style="width: 10px" data-date="2026-10-11" id="contribution-day-component-0-52" data-level="0" role="gridcell" data-view-component="true" class="ContributionCalendar-day"></td>
      <td tabindex="0" data-ix="0" style="width: 10px" data-date="2026-10-12" id="contribution-day-component-1-52" data-level="3" role="gridcell" data-view-component="true" class="ContributionCalendar-day"></td>
      <tool-tip id="t1" for="contribution-day-component-0-52" popover="manual" class="sr-only">No contributions on October 11th.</tool-tip>
      <tool-tip id="t2" for="contribution-day-component-1-52" popover="manual" class="sr-only">1,204 contributions on October 12th.</tool-tip>`;
    expect(parseContributionsHtml(html)).toEqual([
      { date: "2026-10-11", count: 0, level: 0 },
      { date: "2026-10-12", count: 1204, level: 3 },
    ]);
  });
});

describe("profile summaries", () => {
  it("computes language shares from non-fork repositories", () => {
    const repos = [
      { fork: false, language: "TypeScript" }, { fork: false, language: "TypeScript" }, { fork: false, language: "Go" },
      { fork: true, language: "C" }, { fork: false, language: null },
    ];
    expect(languageShares(repos)).toEqual([
      { name: "TypeScript", share: 2 / 3 },
      { name: "Go", share: 1 / 3 },
    ]);
  });

  it("groups push events by repository, newest first", () => {
    const ev = (repo: string, at: string, type = "PushEvent") => ({ type, created_at: at, repo: { name: repo } });
    const r = groupPushes([ev("a/x", "2026-10-01T00:00:00Z"), ev("a/y", "2026-10-03T00:00:00Z"), ev("a/x", "2026-10-02T00:00:00Z"), ev("a/z", "2026-10-04T00:00:00Z", "WatchEvent")]);
    expect(r.map((p) => [p.repo, p.pushes])).toEqual([["a/y", 1], ["a/x", 2]]);
  });
});

describe("project links", () => {
  it("normalizes links and rejects non-web URLs", () => {
    expect(normalizeUrl("github.com/essntl/idea", "Repo")).toBe("https://github.com/essntl/idea");
    expect(normalizeUrl("https://artemk.dev/", "Site")).toBe("https://artemk.dev");
    expect(normalizeUrl("  ", "Site")).toBeNull();
    expect(() => normalizeUrl("javascript:alert(1)", "Site")).toThrow();
  });

  it("names common package registries", () => {
    expect(packageLabel("https://www.npmjs.com/package/x")).toBe("npm");
    expect(packageLabel("https://github.com/essntl/idea/pkgs/container/idea")).toBe("GHCR");
    expect(packageLabel("https://pypi.org/project/x/")).toBe("PyPI");
    expect(packageLabel("https://downloads.example.com/x")).toBe("downloads.example.com");
  });
});

describe("contribution graph", () => {
  it("pads the first week so weekdays line up", () => {
    // 2026-10-13 is a Tuesday.
    const weeks = toWeeks([day("2026-10-13", 1), day("2026-10-14", 1), day("2026-10-15", 1), day("2026-10-16", 1), day("2026-10-17", 1), day("2026-10-18", 1)]);
    expect(weeks[0]!.slice(0, 2)).toEqual([null, null]);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[1]![0]!.date).toBe("2026-10-18");
  });
});
