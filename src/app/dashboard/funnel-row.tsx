import Link from "next/link";
import type { Funnel } from "@/lib/metrics";
import { deltaDirection, formatNumber, formatRelativeDelta } from "@/lib/format";
import { FUNNEL_INK, FUNNEL_RAMP } from "@/lib/chart-theme";
import { Delta, EmptyState } from "@/components/ui";

/**
 * The funnel, in counts.
 *
 * There are no conversion percentages here, no bottleneck flag and no
 * lead-to-close rate, deliberately. At two or three closes in a period those
 * ratios swing by tens of points on a single event — they read as insight and
 * behave as noise. Every rate now lives on the Analysis tab, where the window is
 * long enough for one to mean something.
 *
 * Every bar is a count of prospect records that reached that stage inside the
 * range. Nothing on this row was ever typed in as a total.
 */
export function FunnelRow({ funnel }: { funnel: Funnel }) {
  const max = Math.max(...funnel.stages.map((s) => s.count));

  if (max === 0) {
    return (
      <EmptyState
        title="No pipeline movement in this range."
        hint="Stages are stamped when you move a card on the Pipeline. Nothing reached a stage between these dates."
        action={
          <Link
            href="/pipeline"
            className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent-bright transition-colors hover:bg-accent/20"
          >
            Open pipeline →
          </Link>
        }
      />
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="space-y-2">
        {funnel.stages.map((stage, index) => {
          // Width is proportional to the widest stage, so the drop-off is the
          // visible thing.
          const width = max > 0 ? Math.max((stage.count / max) * 100, stage.count > 0 ? 1.5 : 0) : 0;

          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-xs text-ink-muted">{stage.label}</div>

              <div className="min-w-0 flex-1">
                <div className="h-8 w-full">
                  <div
                    className="flex h-8 items-center rounded-r-[4px] px-2.5 transition-[width] duration-500"
                    style={{
                      width: `${width}%`,
                      background: FUNNEL_RAMP[index],
                      minWidth: stage.count > 0 ? "3rem" : 0,
                    }}
                  >
                    {/* Label sits inside only because minWidth guarantees the bar
                        is wide enough for it; ink is picked per step by luminance. */}
                    {stage.count > 0 ? (
                      <span
                        className="tabular text-sm font-semibold"
                        style={{ color: FUNNEL_INK[index] }}
                      >
                        {formatNumber(stage.count)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex w-24 shrink-0 items-center justify-end gap-1.5">
                {stage.count === 0 ? (
                  <span className="tabular text-sm text-ink-faint">0</span>
                ) : null}
                <Delta
                  text={formatRelativeDelta(stage.count, stage.previousCount)}
                  direction={deltaDirection(stage.count, stage.previousCount)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 border-t border-line pt-2.5 text-[11px] text-ink-faint">
        Counts of prospects that reached each stage in range. Rates between stages live on{" "}
        <Link href="/analysis" className="text-ink-muted underline underline-offset-2">
          Analysis
        </Link>
        .
      </p>
    </div>
  );
}
