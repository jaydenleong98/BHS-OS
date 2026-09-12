/**
 * Display formatting.
 *
 * Every formatter accepts `null` and renders an em-dash. `null` is what
 * lib/metrics.ts returns for an undefined ratio (divide by zero), so a missing
 * denominator surfaces as "—" rather than NaN, Infinity, or a misleading 0%.
 */

export const EMPTY = "—";

const intFmt = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 });

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return intFmt.format(value);
}

/** Takes a 0..1 ratio (or null) and renders "10.7%". */
export function formatPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return EMPTY;
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Signed relative change between two counts, e.g. "+18%". Null when there's no base. */
export function formatRelativeDelta(
  current: number | null | undefined,
  previous: number | null | undefined
): string | null {
  if (
    current === null || current === undefined || !Number.isFinite(current) ||
    previous === null || previous === undefined || !Number.isFinite(previous) ||
    previous === 0
  ) {
    return null;
  }
  const delta = ((current - previous) / previous) * 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}%`;
}

/** Direction of a change, for colouring. `null` when there is nothing to compare. */
export function deltaDirection(
  current: number | null | undefined,
  previous: number | null | undefined
): "up" | "down" | "flat" | null {
  if (
    current === null || current === undefined || !Number.isFinite(current) ||
    previous === null || previous === undefined || !Number.isFinite(previous)
  ) {
    return null;
  }
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}
