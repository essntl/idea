import { getGithubProfile } from "@/lib/github";
import { timeAgo } from "@/lib/format";
import { ArrowRight, FlameIcon } from "@/components/ui/icons";
import { ContributionGraph } from "./contribution-graph";

const SHADES = ["bg-fg", "bg-fg/70", "bg-fg/50", "bg-fg/35", "bg-fg/20", "bg-fg/10"];
const nf = new Intl.NumberFormat("en");

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse justify-end rounded-[var(--radius-md)] bg-surface px-3.5 py-3">
      <dt className="mt-0.5 text-xs text-muted">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight tabular-nums">{nf.format(value)}</dd>
    </div>
  );
}

/** GitHub profile, stats, streaks, contribution calendar, languages and recent pushes. Renders nothing if GitHub is unreachable. */
export async function GithubActivity({ login }: { login: string }) {
  const gh = await getGithubProfile(login);
  if (!gh) return null;
  const c = gh.contributions;
  const days = (n: number) => `${nf.format(n)} day${n === 1 ? "" : "s"}`;

  return (
    <section aria-labelledby="gh-title" className="card p-5 sm:p-6">
      <header className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- external avatar, already sized by GitHub */}
        <img src={`${gh.avatarUrl}${gh.avatarUrl.includes("?") ? "&" : "?"}s=128`} alt="" width={56} height={56} className="size-14 shrink-0 rounded-full bg-surface-2" />
        <div className="min-w-0 flex-1">
          <h2 id="gh-title" className="truncate text-lg font-semibold tracking-tight">
            {gh.name}
          </h2>
          <p className="truncate text-sm text-muted">
            <a href={gh.url} target="_blank" rel="me noopener noreferrer" className="hover:text-fg hover:underline">
              @{gh.login}
            </a>
            {gh.location && <> · {gh.location}</>}
          </p>
        </div>
        <a href={gh.url} target="_blank" rel="me noopener noreferrer" className="btn btn-ghost btn-sm shrink-0 max-sm:hidden">
          GitHub <ArrowRight width={14} height={14} />
        </a>
      </header>
      {gh.bio && <p className="mt-4 text-[0.9375rem] text-muted">{gh.bio}</p>}

      <dl className={`mt-5 grid grid-cols-2 gap-2 ${c ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Stat label="Public repositories" value={gh.publicRepos} />
        <Stat label="Stars earned" value={gh.stars} />
        <Stat label="Followers" value={gh.followers} />
        {c && <Stat label="Contributions" value={c.total} />}
      </dl>

      {c && (
        <>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="flex items-center gap-2 text-[0.9375rem]">
              <FlameIcon width={18} height={18} className={c.currentStreak ? "text-fg" : "text-subtle"} />
              <span>
                <span className="font-semibold">{days(c.currentStreak)}</span> <span className="text-muted">current streak</span>
              </span>
            </p>
            <p className="text-[0.9375rem]">
              <span className="font-semibold">{days(c.longestStreak)}</span> <span className="text-muted">longest streak</span>
            </p>
          </div>
          <div className="mt-4">
            <ContributionGraph days={c.days} total={c.total} />
          </div>
        </>
      )}

      {(gh.languages.length > 0 || gh.recentPushes.length > 0) && (
        <div className="mt-6 grid gap-6 border-t border-line pt-5 md:grid-cols-2 md:gap-10">
          {gh.languages.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Languages</h3>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                {gh.languages.map((l, i) => (
                  <span key={l.name} className={`${SHADES[i] ?? SHADES.at(-1)} border-r-2 border-bg last:border-r-0`} style={{ width: `${l.share * 100}%` }} />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {gh.languages.map((l, i) => (
                  <li key={l.name} className="flex items-center gap-2">
                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${SHADES[i] ?? SHADES.at(-1)}`} />
                    <span className="truncate">{l.name}</span>
                    <span className="ml-auto text-muted tabular-nums">{Math.round(l.share * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {gh.recentPushes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Recently pushed to</h3>
              <ul className="mt-2 divide-y divide-line">
                {gh.recentPushes.map((p) => (
                  <li key={p.repo}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-11 items-center gap-3 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate group-hover:underline">{p.repo.startsWith(`${gh.login}/`) ? p.repo.slice(gh.login.length + 1) : p.repo}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {p.pushes} push{p.pushes === 1 ? "" : "es"} · {timeAgo(p.at)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Same footprint as the widget, so the page doesn't jump when it streams in. */
export function GithubActivitySkeleton() {
  return (
    <div className="card p-5 sm:p-6" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-full bg-surface-2" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-surface-2" />
          <div className="h-3 w-20 rounded bg-surface" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[4.25rem] rounded-[var(--radius-md)] bg-surface" />
        ))}
      </div>
      <div className="mt-6 h-36 rounded-[var(--radius-md)] bg-surface sm:h-40" />
    </div>
  );
}
