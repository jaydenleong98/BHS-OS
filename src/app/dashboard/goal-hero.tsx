import Link from "next/link";
import { formatDMY } from "@/lib/dates";
import { formatDays, formatMYR, formatNumber, formatPct } from "@/lib/format";
import type { GoalGap } from "@/lib/metrics";
import { Badge, cx } from "@/components/ui";

/**
 * The reason the app exists, and the largest thing on the page.
 *
 * The gap is set in serif at display size because nothing else in this dense,
 * all-sans dashboard looks remotely like it — it cannot be skimmed past.
 */
export function GoalHero({ goal }: { goal: GoalGap }) {
  if (goal.targetMrr <= 0) {
    return (
      <section className="rounded-lg border border-accent/30 bg-accent/5 px-5 py-6">
        <p className="text-[11px] font-medium uppercase tracking-wide text-accent-bright">
          MRR goal
        </p>
        <p className="mt-2 font-serif text-4xl text-ink">No target set</p>
        <p className="mt-2 max-w-lg text-sm text-ink-muted">
          Every other number here is context for one question: how far off the goal am I.{" "}
          <Link href="/settings" className="text-accent-bright underline underline-offset-2">
            Set a target MRR
          </Link>{" "}
          and this block starts answering it.
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          Current MRR <span className="tabular text-ink-muted">{formatMYR(goal.currentMrr)}</span>
        </p>
      </section>
    );
  }

  const progress = goal.progress ?? 0;
  const paceTone = goal.pace === "on_track" ? "good" : goal.pace === "behind" ? "bad" : "neutral";
  const paceLabel =
    goal.pace === "on_track" ? "On track" : goal.pace === "behind" ? "Behind" : "Not enough history";

  return (
    <section
      className={cx(
        "rounded-lg border px-5 py-6",
        goal.reached ? "border-good/40 bg-good/5" : "border-accent/30 bg-accent/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-accent-bright">
            {goal.reached ? "Target reached" : "MRR gap"}
          </p>

          {/* The one display-size figure in the app. */}
          <p
            className={cx(
              "mt-1 font-serif text-6xl leading-none tracking-tight sm:text-7xl",
              goal.reached ? "text-good" : "text-ink"
            )}
          >
            {formatMYR(goal.gapMyr)}
          </p>

          <p className="mt-3 text-sm text-ink-muted">
            {goal.closesNeeded === null ? (
              <>No closed client yet, so there is no average fee to price the gap in closes.</>
            ) : goal.closesNeeded === 0 ? (
              <>
                {formatMYR(goal.currentMrr)} against a {formatMYR(goal.targetMrr)} target.
              </>
            ) : (
              <>
                <span className="tabular font-semibold text-ink">{goal.closesNeeded}</span>{" "}
                {goal.closesNeeded === 1 ? "close" : "closes"} at{" "}
                <span className="tabular">{formatMYR(goal.averageMonthlyFee)}</span>/mo average
              </>
            )}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Figure label="Current MRR" value={formatMYR(goal.currentMrr)} />
          <Figure label="Target" value={formatMYR(goal.targetMrr)} />
          <Figure
            label="Weeks to deadline"
            value={formatNumber(goal.weeksRemaining)}
            hint={formatDMY(goal.deadline)}
          />
          <Figure
            label="Weeks to feed pipeline"
            value={formatNumber(goal.weeksToFeedPipeline)}
            hint={
              goal.cycleDays === null
                ? "no cycle history yet"
                : `deadline − ${formatDays(goal.cycleDays, 0)} cycle`
            }
            tone={goal.weeksToFeedPipeline <= 4 ? "warn" : "default"}
          />
        </dl>
      </div>

      <div className="mt-5">
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
          role="img"
          aria-label={`${formatPct(goal.progress, 0)} of target MRR`}
        >
          <div
            className={cx("h-full rounded-full", goal.reached ? "bg-good" : "bg-accent-bright")}
            style={{ width: `${Math.max(progress * 100, progress > 0 ? 1 : 0)}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
          <span className="tabular">{formatPct(goal.progress, 0)} of target</span>
          <Badge tone={paceTone}>
            {goal.pace === "behind" ? "⚠ " : goal.pace === "on_track" ? "✓ " : ""}
            {paceLabel}
          </Badge>
          {goal.requiredClosesPerMonth !== null ? (
            <span className="tabular">
              needs {goal.requiredClosesPerMonth.toFixed(1)}/mo · running at{" "}
              {goal.actualClosesPerMonth === null
                ? "—"
                : goal.actualClosesPerMonth.toFixed(1) + "/mo"}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd
        className={cx(
          "tabular mt-0.5 text-lg font-semibold",
          tone === "warn" ? "text-warn" : "text-ink"
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="text-[11px] text-ink-faint">{hint}</dd> : null}
    </div>
  );
}
