/**
 * Chart palette.
 *
 * Validated against this app's actual chart surface (--color-surface, #0f1420),
 * not a generic dark background. Results at time of writing:
 *
 *   Categorical (7 sources, adjacent pairs — stacks, lines, bars)
 *     lightness band PASS · chroma floor PASS · contrast >= 3:1 PASS
 *     worst adjacent CVD dE 8.4 (protan, yellow<->aqua) · normal-vision dE 19.3
 *
 *   Funnel ordinal ramp (single blue hue, 4 steps)
 *     monotone L PASS · adjacent dL >= 0.06 PASS · light-end 2.78:1 PASS
 *
 *   Diverging pair (new vs churned MRR)
 *     CVD dE 19.2 · normal-vision dE 29.0 · both >= 3:1
 *
 * Re-run the validator if any hex here changes — do not eyeball CVD safety.
 */

import { SOURCES, type Source } from "./types";

/**
 * Fixed hue per source, assigned by position in SOURCES and never by rank.
 * Sorting or filtering the dashboard must never repaint a series: once XHS is
 * blue it stays blue.
 */
export const SOURCE_COLORS: Record<Source, string> = {
  xhs: "#3987e5", // blue
  cold: "#d95926", // orange
  facebook: "#199e70", // aqua
  instagram: "#c98500", // yellow
  tiktok: "#d55181", // magenta
  referral: "#008300", // green
  other: "#9085e9", // violet
};

/** Ordinal ramp for the funnel — one hue, light to dark, stage order. */
export const FUNNEL_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"] as const;

/**
 * Ink for a label sitting inside a funnel bar, picked per step by the fill's
 * luminance. White on the two light steps measures 2.1:1 and 3.0:1 — unreadable —
 * so those carry dark ink instead (8.5:1 and 6.0:1).
 */
export const FUNNEL_INK = ["#08111f", "#08111f", "#ffffff", "#ffffff"] as const;

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

/** Rolling-average overlay: deliberately not a source color, so it reads as derived. */
export const ROLLING_AVERAGE_COLOR = "#e7ecf5";

export const ORDERED_SOURCES = SOURCES;

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
