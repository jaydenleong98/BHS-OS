import Link from "next/link";
import { formatWeekOf } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import type { ContentSummary, ContentWeek } from "@/lib/metrics";
import { Card, cx } from "@/components/ui";

/**
 * Vaneese's weekly output, on the dashboard I actually open — not on a tab I'd
 * have to remember to check.
 *
 * Both trends are single-series, so no categorical palette is involved and no
 * legend is needed: the row label names the series.
 */
export function ContentCard({ content }: { content: ContentSummary }) {
  return (
    <Card
      title="Content output"
      subtitle={`Vaneese · week of ${formatWeekOf(content.current.weekStart).replace("w/c ", "")}`}
      action={
        <Link
          href="/entry?view=weekly"
          className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          Log week →
        </Link>
      }
    >
      <div className="space-y-4">
        <TargetBar
          label="Content posted"
          value={content.current.contentPosted}
          target={content.contentTarget}
        />
        <TargetBar
          label="Blog posts"
          value={content.current.blogPosts}
          target={content.blogTarget}
        />
      </div>

      <div className="mt-5 space-y-3 border-t border-line pt-3">
        <TrendRow
          label="Posts · 8 weeks"
          weeks={content.weeks}
          pick={(w) => w.contentPosted}
          target={content.contentTarget}
        />
        <TrendRow
          label="Blogs · 8 weeks"
          weeks={content.weeks}
          pick={(w) => w.blogPosts}
          target={content.blogTarget}
        />
      </div>
    </Card>
  );
}

function TargetBar({ label, value, target }: { label: string; value: number; target: number }) {
  const ratio = target > 0 ? value / target : 0;
  const met = value >= target;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        <span className="tabular text-sm">
          <span className={cx("font-semibold", met ? "text-good" : "text-ink")}>
            {formatNumber(value)}
          </span>
          <span className="text-ink-faint"> / {formatNumber(target)}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className={cx("h-full rounded-full", met ? "bg-good" : "bg-accent-bright")}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Eight weeks as bars, with the target drawn as a line across them. Heights are
 * scaled to the larger of the peak and the target, so a week that misses badly
 * still reads as short rather than as full-height.
 */
function TrendRow({
  label,
  weeks,
  pick,
  target,
}: {
  label: string;
  weeks: ContentWeek[];
  pick: (week: ContentWeek) => number;
  target: number;
}) {
  const values = weeks.map(pick);
  const ceiling = Math.max(target, ...values, 1);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
        <span className="tabular text-[11px] text-ink-faint">target {target}</span>
      </div>

      <div className="relative flex h-14 items-end gap-1">
        {/* Target line. Dashed so it never reads as a data mark. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong"
          style={{ bottom: `${(target / ceiling) * 100}%` }}
        />
        {weeks.map((week) => {
          const value = pick(week);
          const met = value >= target;
          return (
            <div
              key={week.weekStart}
              className="group relative flex-1"
              title={`${formatWeekOf(week.weekStart)} — ${value}${week.logged ? "" : " (not logged)"}`}
            >
              <div
                className={cx(
                  "w-full rounded-t-[3px]",
                  value === 0 ? "bg-line-strong" : met ? "bg-good/70" : "bg-accent/60"
                )}
                style={{ height: `${Math.max((value / ceiling) * 56, value > 0 ? 3 : 2)}px` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex gap-1">
        {weeks.map((week) => (
          <span
            key={week.weekStart}
            className="tabular flex-1 text-center text-[9px] text-ink-faint"
          >
            {pick(week)}
          </span>
        ))}
      </div>
    </div>
  );
}
