/**
 * Chart palette.
 *
 * Validated against this app's actual chart surface (--color-surface, #0f1420),
 * not a generic dark background. Re-run the validator if any hex here changes —
 * do not eyeball CVD safety.
 *
 * ## Why there is no per-source colour any more
 *
 * There are ten sources. A ten-hue categorical palette cannot pass on this
 * surface — measured, not assumed: chroma floor, adjacent-pair CVD separation and
 * the normal-vision floor all fail, whichever order the hues are put in. Seven is
 * the ceiling here, and folding four real sources into a grey "Other" band would
 * hide exactly the channels this business runs on.
 *
 * So source identity is carried by position and label instead of hue: the source
 * breakdown is a sorted bar chart with named categories on the axis, plus the
 * source table. Single-series charts need no categorical palette at all, and
 * nothing repaints when a filter changes the number of visible sources.
 *
 * Results at time of writing:
 *
 *   Funnel ordinal ramp (single blue hue, 5 steps)
 *     monotone L PASS · adjacent dL 0.098–0.110 (floor 0.06) PASS
 *     every step >= 2.70:1 against the surface
 *
 *   Diverging pair (new vs churned MRR)
 *     CVD dE 19.2 · normal-vision dE 29.0 · both >= 3:1
 */

/**
 * Ordinal ramp for the funnel — one hue, light to dark, in stage order. Five
 * steps for five stages. Never used for categories; the ordering is the meaning.
 */
export const FUNNEL_RAMP = ["#c2dbf9", "#8fbcf1", "#5f9ce9", "#3477d4", "#1f5aa8"] as const;

/**
 * Ink for a label sitting inside a funnel bar, picked per step by the fill's
 * luminance. White on the three light steps measures 1.4:1, 2.0:1 and 2.8:1 —
 * unreadable — so those carry dark ink instead (13.3:1, 9.6:1, 6.7:1).
 */
export const FUNNEL_INK = ["#08111f", "#08111f", "#08111f", "#ffffff", "#ffffff"] as const;

/** Diverging pair: gained vs lost. Warm/cool so the poles read as opposite. */
export const DIVERGING = {
  positive: "#3987e5",
  negative: "#e66767",
  midpoint: "#2c3849",
} as const;

/** Chart chrome. Recessive by design — the data is the only loud thing. */
export const CHROME = {
  surface: "#0f1420",
  grid: "#1e2637",
  axis: "#2c3849",
  inkMuted: "#8d99b0",
  inkFaint: "#5b6780",
  accent: "#3b6fe8",
  accentBright: "#5b8bff",
  warn: "#e0a33a",
  bad: "#ec5f6c",
  good: "#35c88a",
} as const;

/**
 * A second, clearly-different step for the rare two-series chart. Measured
 * against the accent: normal-vision ΔE 25.4, deutan 23.5 — but tritan only 6.5,
 * which sits in the floor band. Legal only with secondary encoding, so any chart
 * using this pair carries a legend, a table view, and separated (never stacked)
 * marks. Both clear 3:1 on the surface.
 */
export const SECONDARY_SERIES = "#199e70";

/**
 * Overlay ink for a series that is derived rather than observed — a rolling
 * average, a net change line. Deliberately not a hue, so it never reads as one
 * more category alongside the bars underneath it.
 */
export const ROLLING_AVERAGE_COLOR = "#e7ecf5";

/** Shared Recharts axis styling, so every chart's chrome matches. */
export const axisProps = {
  stroke: CHROME.axis,
  tick: { fill: CHROME.inkFaint, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHROME.axis },
} as const;

export const gridProps = {
  stroke: CHROME.grid,
  strokeWidth: 1,
  vertical: false,
} as const;
