import type { Funnel } from "@/lib/metrics";
import {
  deltaDirection,
  formatMYRPrecise,
  formatNumber,
  formatPct,
  formatPointDelta,
  formatRelativeDelta,
} from "@/lib/format";
import { FUNNEL_INK, FUNNEL_RAMP } from "@/lib/chart-theme";
import { Delta, EmptyState } from "@/components/ui";

/**
 * Row A — the headline.
 *
 * Drawn as proportional HTML bars rather than a chart library: every count and
 * rate is directly labelled, so there is nothing a tooltip would need to reveal
 * and no value that colour alone carries.
 *
 * The weakest transition is flagged in the warning colour. Note it compares the
 * three rates directly as specified, so a stage can be flagged the bottleneck on
 * an absolute rate even though the stages measure different things.
 */
export function FunnelRow({ funnel }: { funnel: Funnel }) {
  const max = funnel.stages[0].count;

  if (max === 0 && funnel.totals.dealsClosed === 0) {
    return (
      <EmptyState
        title="No funnel activity in this range."
        hint="Log leads and calls on the Daily Entry page, and the funnel fills in from there."
      />
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="space-y-2.5">
        {funnel.stages.map((stage, index) => {
          // Width is proportional to the top of the funnel, so the drop-off is
          // the visible thing. A zero-lead range falls back to a full first bar.
          const width = max > 0 ? Math.max((stage.count / max) * 100, stage.count > 0 ? 1.5 : 0) : 0;
          const relative = formatRelativeDelta(stage.count, stage.previousCount);
          const direction = deltaDirection(stage.count, stage.previousCount);

          return (
            <div key={stage.key}>
              {stage.conversionLabel ? (
                <ConversionConnector
                  label={stage.conversionLabel}
                  rate={stage.conversion}
                  previousRate={stage.previousConversion}
                  isBottleneck={stage.isBottleneck}
                />
              ) : null}

              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-xs text-ink-muted">{stage.label}</div>

                <div className="min-w-0 flex-1">
                  <div className="h-9 w-full">
                    <div
                      className="flex h-9 items-center rounded-r-[4px] px-2.5 transition-[width] duration-500"
                      style={{
                        width: `${width}%`,
                        background: FUNNEL_RAMP[index],
                        minWidth: stage.count > 0 ? "3.5rem" : 0,
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

                <div className="flex w-28 shrink-0 items-center justify-end gap-1.5">
                  {stage.count === 0 ? (
                    <span className="tabular text-sm text-ink-faint">0</span>
                  ) : null}
                  <Delta text={relative} direction={direction} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-3 sm:grid-cols-4">
        <SummaryFigure
          label="Lead → Close"
          value={formatPct(funnel.rates.leadToClose, 2)}
          delta={formatPointDelta(funnel.rates.leadToClose, funnel.previousRates?.leadToClose)}
          direction={deltaDirection(funnel.rates.leadToClose, funnel.previousRates?.leadToClose)}
        />
        <SummaryFigure
          label="Cost per lead"
          value={formatMYRPrecise(funnel.rates.costPerLead)}
          delta={formatRelativeDelta(funnel.rates.costPerLead, funnel.previousRates?.costPerLead)}
          direction={deltaDirection(funnel.rates.costPerLead, funnel.previousRates?.costPerLead)}
          invert
        />
        <SummaryFigure
          label="Cost per acquisition"
          value={formatMYRPrecise(funnel.rates.costPerAcquisition)}
          delta={formatRelativeDelta(
            funnel.rates.costPerAcquisition,
            funnel.previousRates?.costPerAcquisition
          )}
          direction={deltaDirection(
            funnel.rates.costPerAcquisition,
            funnel.previousRates?.costPerAcquisition
          )}
          invert
        />
        <SummaryFigure
          label="Spend"
          value={formatMYRPrecise(funnel.totals.spend)}
          delta={formatRelativeDelta(funnel.totals.spend, funnel.previousTotals?.spend)}
          direction={deltaDirection(funnel.totals.spend, funnel.previousTotals?.spend)}
        />
      </div>
    </div>
  );
}

function ConversionConnector({
  label,
  rate,
  previousRate,
  isBottleneck,
}: {
  label: string;
  rate: number | null;
  previousRate: number | null;
  isBottleneck: boolean;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-3">
      <div className="w-28 shrink-0" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span aria-hidden className="text-xs text-ink-faint">
          ↳
        </span>
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px]",
            isBottleneck
              ? "border-warn/40 bg-warn/10 text-warn"
              : "border-line bg-surface-2 text-ink-muted",
          ].join(" ")}
        >
          {isBottleneck ? <span aria-hidden>⚠</span> : null}
          {label} <span className="tabular font-medium">{formatPct(rate)}</span>
          {isBottleneck ? <span className="font-medium">· bottleneck</span> : null}
        </span>
        <Delta
          text={formatPointDelta(rate, previousRate)}
          direction={deltaDirection(rate, previousRate)}
        />
      </div>
      <div className="w-28 shrink-0" />
    </div>
  );
}

function SummaryFigure({
  label,
  value,
  delta,
  direction,
  invert = false,
}: {
  label: string;
  value: string;
  delta: string | null;
  direction: "up" | "down" | "flat" | null;
  invert?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-base font-semibold text-ink">{value}</span>
        <Delta text={delta} direction={direction} invert={invert} />
      </div>
    </div>
  );
}
