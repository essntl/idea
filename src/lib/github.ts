/**
 * Public GitHub data for the projects pages: profile, contribution calendar (+ streaks), recent pushes and
 * per-repository stats. Works without a token (60 API requests/hour, calendar read from the public
 * contributions page); set GITHUB_TOKEN for 5,000/hour and the GraphQL calendar.
 *
 * Everything is cached; failures never break a page (callers get null and render without the widget).
 */
import "server-only";
import { unstable_cache } from "next/cache";

const API = "https://api.github.com";
const TIMEOUT_MS = 5_000;
const PROFILE_TTL = 30 * 60;
const REPO_TTL = 60 * 60;
/** After a failure (rate limit, outage), don't call GitHub again for a while. */
const BACKOFF_MS = 5 * 60_000;

const token = () => process.env.GITHUB_TOKEN?.trim() || "";
let backoffUntil = 0;

class GithubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  if (Date.now() < backoffUntil) throw new GithubError(503, "GitHub temporarily skipped after an earlier failure");
  const t = token();
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "idea-site",
        "x-github-api-version": "2022-11-28",
        ...(t && url.startsWith(API) ? { authorization: `Bearer ${t}` } : {}),
        ...init.headers,
      },
    });
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      backoffUntil = Date.now() + BACKOFF_MS;
      throw new GithubError(res.status, `GitHub responded ${res.status}`);
    }
    return res;
  } catch (err) {
    if (err instanceof GithubError) throw err;
    backoffUntil = Date.now() + BACKOFF_MS;
    throw new GithubError(0, `GitHub request failed: ${(err as Error).message}`);
  }
}

async function json<T>(path: string): Promise<T> {
  const res = await request(`${API}${path}`);
  if (!res.ok) throw new GithubError(res.status, `GitHub ${path} → ${res.status}`);
  return (await res.json()) as T;
}

/* --------------------------------- URLs ---------------------------------- */

const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

/** "https://github.com/essntl" or "https://github.com/essntl/idea" → "essntl". */
export function githubUsername(url: string | null | undefined): string | null {
  const m = url?.trim().match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)/i);
  return m && NAME.test(m[1]!) ? m[1]! : null;
}

/** "https://github.com/essntl/idea(.git)(/tree/…)" → { owner, repo }. */
export function parseGithubRepo(url: string | null | undefined): { owner: string; repo: string } | null {
  const m = url?.trim().match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)/i);
  if (!m) return null;
  const owner = m[1]!;
  const repo = m[2]!.replace(/\.git$/i, "");
  return NAME.test(owner) && REPO.test(repo) ? { owner, repo } : null;
}

/* ----------------------------- contributions ----------------------------- */

export type ContributionDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type Contributions = { total: number; days: ContributionDay[]; currentStreak: number; longestStreak: number };

const clampLevel = (n: number) => Math.max(0, Math.min(4, Math.round(n))) as ContributionDay["level"];

/**
 * Streaks over a date-sorted calendar. The current streak counts back from the last day; a last day
 * without contributions doesn't break it (the day isn't over yet).
 */
export function computeStreaks(days: ContributionDay[]): { current: number; longest: number } {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i]!.count === 0) i--;
  for (; i >= 0 && days[i]!.count > 0; i--) current++;
  return { current, longest };
}

/** Parses github.com/users/<name>/contributions (the public calendar fragment). */
export function parseContributionsHtml(html: string): ContributionDay[] {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = m[2]!.trim().match(/^([\d,]+)\s+contribution/);
    counts.set(m[1]!, n ? Number(n[1]!.replace(/,/g, "")) : 0);
  }
  const days: ContributionDay[] = [];
  for (const m of html.matchAll(/<td\b[^>]*class="ContributionCalendar-day"[^>]*>/g)) {
    const tag = m[0];
    const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    if (!date) continue;
    const id = tag.match(/\bid="([^"]+)"/)?.[1] ?? "";
    const level = clampLevel(Number(tag.match(/data-level="(\d)"/)?.[1] ?? 0));
    days.push({ date, level, count: counts.get(id) ?? (level > 0 ? 1 : 0) });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

const LEVELS: Record<string, ContributionDay["level"]> = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function contributionDays(login: string): Promise<ContributionDay[]> {
  if (token()) {
    const res = await request(`${API}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel}}}}}}`,
        variables: { login },
      }),
    });
    if (!res.ok) throw new GithubError(res.status, `GitHub GraphQL → ${res.status}`);
    type Week = { contributionDays: { date: string; contributionCount: number; contributionLevel: string }[] };
    const body = (await res.json()) as { data?: { user?: { contributionsCollection: { contributionCalendar: { weeks: Week[] } } } } };
    const weeks = body.data?.user?.contributionsCollection.contributionCalendar.weeks ?? [];
    return weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0 })));
  }
  const res = await request(`https://github.com/users/${encodeURIComponent(login)}/contributions`, { headers: { accept: "text/html" } });
  if (!res.ok) throw new GithubError(res.status, `GitHub contributions → ${res.status}`);
  return parseContributionsHtml(await res.text());
}

/* --------------------------------- profile -------------------------------- */

export type LanguageShare = { name: string; share: number };
export type RecentPush = { repo: string; url: string; pushes: number; at: string };

export type GithubProfile = {
  login: string;
  name: string;
  avatarUrl: string;
  url: string;
  bio: string | null;
  location: string | null;
  publicRepos: number;
  followers: number;
  stars: number;
  languages: LanguageShare[];
  contributions: Contributions | null;
  recentPushes: RecentPush[];
};

type ApiUser = { login: string; name: string | null; avatar_url: string; html_url: string; bio: string | null; location: string | null; public_repos: number; followers: number };
type ApiRepo = { name: string; full_name: string; fork: boolean; archived: boolean; stargazers_count: number; language: string | null; pushed_at: string | null };
type ApiEvent = { type: string; created_at: string; repo: { name: string } };

/** Share of non-fork repositories per primary language (top 5 + "Other"). */
export function languageShares(repos: Pick<ApiRepo, "fork" | "language">[]): LanguageShare[] {
  const counts = new Map<string, number>();
  for (const r of repos) if (!r.fork && r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5).map(([name, n]) => ({ name, share: n / total }));
  const rest = sorted.slice(5).reduce((a, [, n]) => a + n, 0);
  return rest ? [...top, { name: "Other", share: rest / total }] : top;
}

/** Push events grouped by repository, most recent first. */
export function groupPushes(events: ApiEvent[], limit = 5): RecentPush[] {
  const byRepo = new Map<string, RecentPush>();
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const cur = byRepo.get(e.repo.name);
    if (cur) {
      cur.pushes++;
      if (e.created_at > cur.at) cur.at = e.created_at;
    } else byRepo.set(e.repo.name, { repo: e.repo.name, url: `https://github.com/${e.repo.name}`, pushes: 1, at: e.created_at });
  }
  return [...byRepo.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

async function loadProfile(login: string): Promise<GithubProfile> {
  const user = await json<ApiUser>(`/users/${encodeURIComponent(login)}`);
  const [repos, events, days] = await Promise.allSettled([
    json<ApiRepo[]>(`/users/${encodeURIComponent(login)}/repos?per_page=100&type=owner&sort=pushed`),
    json<ApiEvent[]>(`/users/${encodeURIComponent(login)}/events/public?per_page=100`),
    contributionDays(login),
  ]);
  const repoList = repos.status === "fulfilled" ? repos.value : [];
  let contributions: Contributions | null = null;
  if (days.status === "fulfilled" && days.value.length) {
    const { current, longest } = computeStreaks(days.value);
    contributions = { total: days.value.reduce((a, d) => a + d.count, 0), days: days.value, currentStreak: current, longestStreak: longest };
  }
  return {
    login: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
    url: user.html_url,
    bio: user.bio,
    location: user.location,
    publicRepos: user.public_repos,
    followers: user.followers,
    stars: repoList.filter((r) => !r.fork).reduce((a, r) => a + r.stargazers_count, 0),
    languages: languageShares(repoList),
    contributions,
    recentPushes: events.status === "fulfilled" ? groupPushes(events.value) : [],
  };
}

const cachedProfile = unstable_cache(loadProfile, ["github-profile"], { revalidate: PROFILE_TTL, tags: ["github"] });

export async function getGithubProfile(login: string | null): Promise<GithubProfile | null> {
  if (!login) return null;
  try {
    return await cachedProfile(login);
  } catch (err) {
    console.warn("[github] profile unavailable:", (err as Error).message);
    return null;
  }
}

/* ------------------------------- repositories ------------------------------ */

export type RepoCommit = { sha: string; message: string; url: string; at: string };
export type RepoStats = {
  fullName: string;
  url: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  license: string | null;
  pushedAt: string | null;
  archived: boolean;
  release: { tag: string; url: string; at: string } | null;
};

type ApiRepoFull = ApiRepo & {
  html_url: string; forks_count: number; open_issues_count: number; license: { spdx_id: string | null; name: string } | null;
};

async function loadRepo(owner: string, repo: string): Promise<RepoStats | null> {
  const res = await request(`${API}/repos/${owner}/${repo}`);
  if (res.status === 404) return null; // private or gone: nothing to show
  if (!res.ok) throw new GithubError(res.status, `GitHub repo → ${res.status}`);
  const r = (await res.json()) as ApiRepoFull;
  return {
    fullName: r.full_name, url: r.html_url, stars: r.stargazers_count, forks: r.forks_count, openIssues: r.open_issues_count,
    language: r.language, license: r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : (r.license?.name ?? null),
    pushedAt: r.pushed_at, archived: r.archived, release: null,
  };
}

async function loadRepoDetail(owner: string, repo: string): Promise<{ stats: RepoStats | null; commits: RepoCommit[] }> {
  const stats = await loadRepo(owner, repo);
  if (!stats) return { stats: null, commits: [] };
  const [commits, release] = await Promise.allSettled([
    json<{ sha: string; html_url: string; commit: { message: string; author: { date: string } | null; committer: { date: string } | null } }[]>(
      `/repos/${owner}/${repo}/commits?per_page=6`,
    ),
    request(`${API}/repos/${owner}/${repo}/releases/latest`).then(async (res) =>
      res.ok ? ((await res.json()) as { tag_name: string; html_url: string; published_at: string | null; created_at: string }) : null,
    ),
  ]);
  const rel = release.status === "fulfilled" ? release.value : null;
  return {
    stats: { ...stats, release: rel ? { tag: rel.tag_name, url: rel.html_url, at: rel.published_at ?? rel.created_at } : null },
    commits:
      commits.status === "fulfilled"
        ? commits.value.map((c) => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split("\n")[0]!.slice(0, 140),
            url: c.html_url,
            at: c.commit.author?.date ?? c.commit.committer?.date ?? "",
          }))
        : [],
  };
}

const cachedRepo = unstable_cache(loadRepo, ["github-repo"], { revalidate: REPO_TTL, tags: ["github"] });
const cachedRepoDetail = unstable_cache(loadRepoDetail, ["github-repo-detail"], { revalidate: REPO_TTL, tags: ["github"] });

/** Small stats for project cards. */
export async function getRepoStats(url: string | null): Promise<RepoStats | null> {
  const r = parseGithubRepo(url);
  if (!r) return null;
  try {
    return await cachedRepo(r.owner, r.repo);
  } catch (err) {
    console.warn("[github] repo unavailable:", (err as Error).message);
    return null;
  }
}

/** Stats, latest release and recent commits for a project page. */
export async function getRepoDetail(url: string | null): Promise<{ stats: RepoStats | null; commits: RepoCommit[] } | null> {
  const r = parseGithubRepo(url);
  if (!r) return null;
  try {
    return await cachedRepoDetail(r.owner, r.repo);
  } catch (err) {
    console.warn("[github] repo detail unavailable:", (err as Error).message);
    return null;
  }
}
