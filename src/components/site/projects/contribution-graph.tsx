import type { ContributionDay } from "@/lib/github";

const LEVEL_CLASS = ["bg-surface-2", "bg-fg/20", "bg-fg/40", "bg-fg/65", "bg-fg"] as const;
/** Phones show the last 26 weeks; wider screens the whole year. */
const PHONE_WEEKS = 26;

const monthFmt = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** Sunday-first weeks; the first week is padded so weekdays line up in rows. */
export function toWeeks(days: ContributionDay[]): (ContributionDay | null)[][] {
  if (!days.length) return [];
  const weeks: (ContributionDay | null)[][] = [];
  let week: (ContributionDay | null)[] = Array.from({ length: utc(days[0]!.date).getUTCDay() }, () => null);
  for (const d of days) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) weeks.push(week);
  return weeks;
}

/** Month name above the first week of each month; the first column is skipped when its month is nearly over. */
function monthLabels(weeks: (ContributionDay | null)[][]): string[] {
  const labels: string[] = [];
  let last = -1;
  weeks.forEach((week, w) => {
    const first = utc(week.find((d) => d !== null)!.date);
    const month = first.getUTCMonth();
    labels.push(month !== last && (w > 0 || first.getUTCDate() <= 21) ? monthFmt.format(first) : "");
    last = month;
  });
  return labels;
}

/**
 * GitHub-style calendar as a CSS grid that always fits its container (no sideways scrolling):
 * one column per week, a month label on top, seven day cells below.
 */
export function ContributionGraph({ days, total }: { days: ContributionDay[]; total: number }) {
  const weeks = toWeeks(days);
  const labels = monthLabels(weeks);
  return (
    <figure>
      <div
        role="img"
        aria-label={`${total.toLocaleString("en")} contributions in the last year`}
        className="grid grid-flow-col grid-rows-[auto_repeat(7,auto)] gap-[3px] [grid-auto-columns:minmax(0,1fr)]"
      >
        {weeks.map((week, w) => {
          const label = labels[w];
          const hide = w < weeks.length - PHONE_WEEKS ? "max-sm:hidden" : "";
          return [
            <span key={`m${w}`} aria-hidden="true" className={`h-4 overflow-visible text-[10px] leading-4 whitespace-nowrap text-subtle ${hide}`}>
              {label}
            </span>,
            ...Array.from({ length: 7 }, (_, d) => {
              const day = week[d];
              return day ? (
                <span
                  key={day.date}
                  title={`${day.count === 0 ? "No" : day.count} contribution${day.count === 1 ? "" : "s"} on ${dayFmt.format(utc(day.date))}`}
                  className={`aspect-square rounded-[3px] ${LEVEL_CLASS[day.level]} ${hide}`}
                />
              ) : (
                <span key={`e${w}-${d}`} aria-hidden="true" className={hide} />
              );
            }),
          ];
        })}
      </div>
      <figcaption className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          <span className="sm:hidden">Last 6 months</span>
          <span className="max-sm:hidden">Last 12 months</span>
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          Less
          {LEVEL_CLASS.map((c) => (
            <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}
