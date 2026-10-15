import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listProjects } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { githubUsername } from "@/lib/github";
import { PHASE_META, PHASE_ORDER, PROJECT_PHASES, type ProjectPhase } from "@/lib/projects";
import { ProjectGrid } from "@/components/site/projects/project-card";
import { GithubActivity, GithubActivitySkeleton } from "@/components/site/projects/github-activity";

const DESCRIPTION = "What I'm building, what's shipped and what's on hold, with the code and progress notes behind each.";

export const metadata: Metadata = { title: "Projects", description: DESCRIPTION, alternates: { canonical: "/projects" } };

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const raw = (await searchParams).phase;
  const phase = PROJECT_PHASES.find((p) => p === raw) as ProjectPhase | undefined;
  const [settings, projects] = await Promise.all([getSettings(), listProjects()]);
  const login = settings.showGithubActivity ? githubUsername(settings.githubUrl) : null;
  const shown = phase ? projects.filter((p) => p.phase === phase) : projects;
  const counts = PHASE_ORDER.map((p) => ({ phase: p, count: projects.filter((x) => x.phase === p).length })).filter((x) => x.count > 0);

  return (
    <div className="container-wide">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-2 text-muted">{DESCRIPTION}</p>
      </header>

      {login && (
        <div className="mt-8">
          <Suspense fallback={<GithubActivitySkeleton />}>
            <GithubActivity login={login} />
          </Suspense>
        </div>
      )}

      <section className="mt-12" aria-labelledby="projects-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2 id="projects-title" className="text-sm font-medium tracking-wider text-muted uppercase">
            {phase ? PHASE_META[phase].label : "All projects"} <span className="tabular-nums">· {shown.length}</span>
          </h2>
          {counts.length > 1 && (
            <nav aria-label="Filter by status">
              <ul className="flex flex-wrap gap-1.5">
                <li>
                  <Link href="/projects" scroll={false} className="chip min-h-8 px-3" aria-current={!phase ? "page" : undefined}>
                    All
                  </Link>
                </li>
                {counts.map(({ phase: p, count }) => (
                  <li key={p}>
                    <Link href={`/projects?phase=${p}`} scroll={false} className="chip min-h-8 px-3" aria-current={phase === p ? "page" : undefined}>
                      {PHASE_META[p].label} <span className="tabular-nums opacity-70">{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        {shown.length ? (
          <ProjectGrid items={shown} priorityFirst />
        ) : (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong py-12 text-center text-muted">
            {projects.length ? "No projects with this status." : "No projects yet."}
          </p>
        )}
      </section>
    </div>
  );
}
