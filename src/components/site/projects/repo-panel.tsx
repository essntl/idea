import { getRepoDetail } from "@/lib/github";
import { formatDate, timeAgo } from "@/lib/format";
import { ArrowRight, CommitIcon, ForkIcon, StarIcon, TagIcon } from "@/components/ui/icons";

/** Repository facts and recent commits for a project page. Renders nothing for non-GitHub or unreachable repos. */
export async function RepoPanel({ url }: { url: string | null }) {
  const detail = await getRepoDetail(url);
  if (!detail?.stats) return null;
  const { stats: s, commits } = detail;
  const facts = [s.language, s.license, s.archived ? "Archived" : null].filter(Boolean);

  return (
    <section aria-labelledby="repo-title" className="card p-5">
      <h2 id="repo-title" className="text-sm font-medium text-muted">
        Repository
      </h2>
      <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate font-semibold hover:underline">
        {s.fullName}
      </a>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <li className="inline-flex items-center gap-1.5" title="Stars">
          <StarIcon width={15} height={15} /> {s.stars}
        </li>
        <li className="inline-flex items-center gap-1.5" title="Forks">
          <ForkIcon width={15} height={15} /> {s.forks}
        </li>
        <li title="Open issues and pull requests">{s.openIssues} open</li>
      </ul>
      {facts.length > 0 && <p className="mt-1 text-sm text-muted">{facts.join(" · ")}</p>}
      {s.pushedAt && <p className="mt-1 text-sm text-muted">Last push {timeAgo(s.pushedAt)}</p>}

      {s.release && (
        <a href={s.release.url} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-2.5 rounded-[var(--radius-md)] bg-surface px-3 py-2.5 text-sm hover:bg-surface-2">
          <TagIcon width={16} height={16} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            Latest release <span className="font-semibold">{s.release.tag}</span>
          </span>
          <span className="shrink-0 text-xs text-muted">{formatDate(s.release.at, "short")}</span>
        </a>
      )}

      {commits.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-medium">Recent commits</h3>
          <ol className="mt-2 space-y-1">
            {commits.map((c) => (
              <li key={c.sha}>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="group -mx-2 flex gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-surface">
                  <CommitIcon width={16} height={16} className="mt-0.5 shrink-0 text-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm">{c.message}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      <code className="font-mono">{c.sha}</code>
                      {c.at && <> · {timeAgo(c.at)}</>}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <a href={`${s.url}/commits`} target="_blank" rel="noopener noreferrer" className="tap mt-1 gap-1.5 text-sm hover:underline">
            All commits <ArrowRight width={14} height={14} />
          </a>
        </div>
      )}
    </section>
  );
}

export function RepoPanelSkeleton() {
  return (
    <div className="card p-5" aria-hidden="true">
      <div className="h-3 w-20 rounded bg-surface-2" />
      <div className="mt-2 h-4 w-40 rounded bg-surface-2" />
      <div className="mt-4 h-3 w-32 rounded bg-surface" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 rounded bg-surface" />
        ))}
      </div>
    </div>
  );
}
