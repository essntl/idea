import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import type { ProjectListItem } from "@/lib/queries";
import { getRepoStats } from "@/lib/github";
import { timeAgo } from "@/lib/format";
import { StarIcon } from "@/components/ui/icons";
import { PhaseBadge } from "./phase-badge";
import { StackList } from "./stack-list";
import { ProjectLinkIcons } from "./project-links";

/** Stars, language and last push from GitHub; streams in after the card. */
async function RepoMeta({ url, fallbackDate }: { url: string | null; fallbackDate: string }) {
  const stats = await getRepoStats(url);
  const parts = stats
    ? [
        stats.stars > 0 && (
          <span key="stars" className="inline-flex items-center gap-1" title={`${stats.stars} stars on GitHub`}>
            <StarIcon width={14} height={14} />
            {stats.stars}
          </span>
        ),
        stats.language && <span key="lang">{stats.language}</span>,
        stats.pushedAt && <span key="push">Updated {timeAgo(stats.pushedAt)}</span>,
      ].filter(Boolean)
    : [<span key="upd">Updated {timeAgo(fallbackDate)}</span>];
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {parts}
    </span>
  );
}

export function ProjectCard({ project: p, priority = false }: { project: ProjectListItem; priority?: boolean }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden card transition-colors hover:border-line-strong">
      {p.previewImage && (
        <div className="relative aspect-[16/9] overflow-hidden border-b border-line bg-surface">
          <Image
            src={p.previewImage.url}
            alt={p.previewImage.alt || ""}
            fill
            sizes="(min-width: 1024px) 480px, (min-width: 640px) 45vw, 100vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            priority={priority}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <PhaseBadge phase={p.phase} />
          {p.featured && <span className="text-xs text-subtle">Featured</span>}
        </div>
        <h3 className="mt-3 text-lg leading-snug font-semibold tracking-tight">
          <Link href={`/projects/${p.slug}`} className="after:absolute after:inset-0 group-hover:underline">
            {p.title}
          </Link>
        </h3>
        {p.summary && <p className="mt-1.5 line-clamp-3 text-[0.9375rem] text-muted">{p.summary}</p>}
        <StackList stack={p.stack} limit={5} className="mt-4" />
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm text-muted">
          <Suspense fallback={<span />}>
            <RepoMeta url={p.repoUrl} fallbackDate={p.updatedAt} />
          </Suspense>
          <ProjectLinkIcons links={p} title={p.title} />
        </div>
      </div>
    </article>
  );
}

export function ProjectGrid({ items, priorityFirst = false }: { items: ProjectListItem[]; priorityFirst?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((p, i) => (
        <li key={p.id}>
          <ProjectCard project={p} priority={priorityFirst && i === 0} />
        </li>
      ))}
    </ul>
  );
}
