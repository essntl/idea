import Link from "next/link";
import type { ProjectLink } from "@/lib/queries";
import { ArrowRight } from "@/components/ui/icons";

/** "Progress update for <project>" link on blog posts and articles that belong to a project. */
export function ProjectNote({ project }: { project: ProjectLink }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-line pr-3 pl-3.5 text-sm hover:bg-surface"
    >
      <span className="shrink-0 text-muted">Progress update for</span>
      <span className="truncate font-medium">{project.title}</span>
      <ArrowRight width={14} height={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
