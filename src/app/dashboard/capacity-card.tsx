import { formatDays, formatPct } from "@/lib/format";
import type { Capacity } from "@/lib/metrics";
import { Badge, Card, cx } from "@/components/ui";

/**
 * The one card in this app that can tell me to stop.
 *
 * Every other metric here rewards more — more prospects, more content, more MRR.
 * Active builds has a ceiling, and at or above it the honest instruction is to
 * stop selling until delivery clears. Amber at the ceiling, red above it, and the
 * words "pause selling" printed rather than left to the colour.
 */
export function CapacityCard({ capacity }: { capacity: Capacity }) {
  const { activeBuilds, ceiling, tone } = capacity;

  const ring =
    tone === "over" ? "border-bad/50 bg-bad/5" : tone === "at" ? "border-warn/50 bg-warn/5" : "border-line bg-surface";
  const figure = tone === "over" ? "text-bad" : tone === "at" ? "text-warn" : "text-ink";

  return (
    <Card
      title="Fulfilment capacity"
      subtitle={`Ceiling ${ceiling} active builds`}
      className={ring}
      bodyClassName="p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Active builds
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cx("tabular text-5xl font-semibold tracking-tight", figure)}>
              {activeBuilds}
            </span>
            <span className="tabular text-lg text-ink-faint">/ {ceiling}</span>
          </div>
        </div>

        {tone === "ok" ? (
          <Badge tone="good">✓ Room to sell</Badge>
        ) : (
          <Badge tone={tone === "over" ? "bad" : "warn"}>
            ⚠ Pause selling{tone === "over" ? " — over ceiling" : ""}
          </Badge>
        )}
      </div>

      {/* Slots, drawn one per unit so "one over" is countable rather than inferred. */}
      <div className="mt-3 flex gap-1">
        {Array.from({ length: Math.max(ceiling, activeBuilds) }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cx(
              "h-1.5 flex-1 rounded-full",
              i >= ceiling
                ? "bg-bad"
                : i < activeBuilds
                  ? tone === "at"
                    ? "bg-warn"
                    : "bg-accent-bright"
                  : "bg-surface-3"
            )}
          />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Avg close to live</dt>
          <dd
            className={cx(
              "tabular mt-0.5 text-lg font-semibold",
              capacity.closeToLiveBehind ? "text-warn" : "text-ink"
            )}
          >
            {formatDays(capacity.closeToLiveDays, 0)}
          </dd>
          <dd className="text-[11px] text-ink-faint">
            target {capacity.closeToLiveTarget} days · won date to go-live
          </dd>
        </div>

        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Onboarding done</dt>
          <dd className="tabular mt-0.5 text-lg font-semibold text-ink">
            {formatPct(capacity.onboardingCompletion, 0)}
          </dd>
          <dd className="text-[11px] text-ink-faint">checklist, averaged over active clients</dd>
        </div>
      </dl>
    </Card>
  );
}
