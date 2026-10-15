import { PHASE_META, type ProjectPhase } from "@/lib/projects";

const STYLE: Record<ProjectPhase, string> = {
  live: "border-fg bg-fg text-bg",
  building: "border-fg text-fg",
  planning: "border-dashed border-line-strong text-muted",
  paused: "border-line bg-surface text-muted",
  archived: "border-line bg-surface text-subtle",
};

const DOT: Record<ProjectPhase, string> = {
  live: "bg-bg",
  building: "bg-fg",
  planning: "border border-current",
  paused: "bg-current opacity-60",
  archived: "bg-current opacity-40",
};

export function PhaseBadge({ phase, className = "" }: { phase: ProjectPhase; className?: string }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium ${STYLE[phase]} ${className}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[phase]}`} />
      {PHASE_META[phase].label}
    </span>
  );
}
