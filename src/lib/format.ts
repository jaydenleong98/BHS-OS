/**
 * Display formatting. Currency is MYR throughout.
 *
 * Every formatter accepts `null` and renders an em-dash. `null` is what
 * lib/metrics.ts returns for an undefined ratio (divide by zero), so a missing
 * denominator surfaces as "—" rather than NaN, Infinity, or a misleading 0%.
 */

export const EMPTY = "—";

const intFmt = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 });
const moneyFmt = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactMoneyFmt = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 });

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return intFmt.format(value);
}

/** "RM 6,500" — whole ringgit. Use for totals and headline cards. */
export function formatMYR(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return `RM ${compactMoneyFmt.format(Math.round(value))}`;
}

/** "RM 7.62" — keeps sen. Use for per-unit costs like CPL. */
export function formatMYRPrecise(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return `RM ${moneyFmt.format(value)}`;
}

/** Axis-friendly: "RM 12k". */
export function formatMYRCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `RM ${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `RM ${Math.round(value / 1_000)}k`;
  return `RM ${Math.round(value)}`;
}

/** Takes a 0..1 ratio (or null) and renders "10.7%". */
export function formatPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return EMPTY;
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Signed percentage-point change between two ratios, e.g. "+2.4pp". */
export function formatPointDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  digits = 1
): string | null {
  if (
    current === null || current === undefined || !Number.isFinite(current) ||
    previous === null || previous === undefined || !Number.isFinite(previous)
  ) {
    return null;
  }
  const delta = (current - previous) * 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(digits)}pp`;
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

/** "12.4 days" / "—". */
export function formatDays(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return `${value.toFixed(digits)} ${Math.abs(value) === 1 ? "day" : "days"}`;
}

/** "1.8×" — for the delivery load indicator. */
export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return `${value.toFixed(digits)}×`;
}
