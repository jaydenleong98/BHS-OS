"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  describeRange,
  RANGE_LABELS,
  RANGE_PRESETS,
  type DateRange,
  type RangePreset,
} from "@/lib/dates";
import { cx } from "@/components/ui";

/**
 * One filter row above everything it scopes. There are deliberately no per-card
 * filters — every card re-renders against the same slice.
 */
export function RangeSelector({
  preset,
  range,
  previous,
  maxDate,
  basePath = "/dashboard",
  keep,
}: {
  preset: RangePreset;
  range: DateRange;
  previous: DateRange;
  maxDate: string;
  /** The page this row scopes. Dashboard and Analysis share it. */
  basePath?: string;
  /** Query params the page owns that a range change must not drop. */
  keep?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(preset === "custom");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  function apply(next: RangePreset, customFrom?: string, customTo?: string) {
    const params = new URLSearchParams();
    params.set("range", next);
    if (next === "custom") {
      params.set("from", customFrom ?? from);
      params.set("to", customTo ?? to);
    }
    for (const [key, value] of Object.entries(keep ?? {})) {
      if (value) params.set(key, value);
    }
    startTransition(() => router.push(`${basePath}?${params.toString()}`));
  }

  return (
    <div className="sticky top-[49px] z-20 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (p === "custom") setCustomOpen((open) => !open);
                else {
                  setCustomOpen(false);
                  apply(p);
                }
              }}
              aria-pressed={preset === p}
              className={cx(
                "rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                preset === p
                  ? "bg-accent/15 text-accent-bright"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {RANGE_LABELS[p]}
            </button>
          ))}
        </div>

        {customOpen ? (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Range start"
              className="tabular rounded-md border border-line bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
            <span className="text-xs text-ink-faint">→</span>
            <input
              type="date"
              value={to}
              max={maxDate}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Range end"
              className="tabular rounded-md border border-line bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => apply("custom", from, to)}
              className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-bright"
            >
              Apply
            </button>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="tabular text-ink-muted">{describeRange(range)}</span>
          <span className="hidden text-ink-faint sm:inline">
            vs <span className="tabular">{describeRange(previous)}</span>
          </span>
          {pending ? <span className="text-accent-bright">updating…</span> : null}
        </div>
      </div>
    </div>
  );
}
