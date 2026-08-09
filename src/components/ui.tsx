import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Standard panel. Every dashboard row sits in one of these. */
export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-lg border border-line bg-surface", className)}>
      {title ? (
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cx("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Compact KPI tile: label on top, value dominant, optional footnote. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  delta,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "accent";
  delta?: ReactNode;
}) {
  const toneClass = {
    default: "text-ink",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
    accent: "text-accent-bright",
  }[tone];

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={cx("tabular mt-1.5 text-2xl font-semibold tracking-tight", toneClass)}>
        {value}
      </div>
      {hint || delta ? (
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
          {delta}
          {hint ? <span>{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Signed change chip. Renders nothing when there's no comparable previous value. */
export function Delta({
  text,
  direction,
  /** Set when a decrease is the good outcome (cost per lead, churn, delivery time). */
  invert = false,
}: {
  text: string | null;
  direction: "up" | "down" | "flat" | null;
  invert?: boolean;
}) {
  if (!text || !direction) return null;

  const positive = invert ? direction === "down" : direction === "up";
  const negative = invert ? direction === "up" : direction === "down";

  return (
    <span
      className={cx(
        "tabular inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-medium",
        direction === "flat" && "bg-surface-2 text-ink-faint",
        positive && "bg-good/10 text-good",
        negative && "bg-bad/10 text-bad"
      )}
    >
      {direction === "up" ? "▲" : direction === "down" ? "▼" : "—"} {text}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  const toneClass = {
    neutral: "border-line-strong bg-surface-2 text-ink-muted",
    good: "border-good/30 bg-good/10 text-good",
    warn: "border-warn/30 bg-warn/10 text-warn",
    bad: "border-bad/30 bg-bad/10 text-bad",
    accent: "border-accent/40 bg-accent/10 text-accent-bright",
  }[tone];

  return (
    <span
      className={cx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        toneClass
      )}
    >
      {children}
    </span>
  );
}

/**
 * Shown wherever a query legitimately returns nothing. Never a substitute for a
 * real zero — this means "no data recorded", not "the value is 0".
 */
export function EmptyState({
  title,
  hint,
  action,
  compact = false,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-line text-center",
        compact ? "px-4 py-6" : "px-6 py-12"
      )}
    >
      <p className="text-sm text-ink-muted">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-xs text-ink-faint">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded", className)} />;
}

/** Section heading used to label the dashboard rows. */
export function RowHeading({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-ink">{children}</h2>
        {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
      </div>
      {action}
    </div>
  );
}
