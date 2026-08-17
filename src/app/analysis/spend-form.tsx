"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMonthKey } from "@/lib/dates";
import { formatMYR } from "@/lib/format";
import { SOURCES, SOURCE_LABELS, type MonthlySpend, type Source } from "@/lib/types";
import { Card, cx } from "@/components/ui";
import { saveMonthlySpend } from "./actions";

/** Monthly ad spend. Twelve numbers a year, not seventy a week. */
export function SpendForm({
  month,
  maxMonth,
  rows,
}: {
  month: string;
  maxMonth: string;
  rows: MonthlySpend[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const source of SOURCES) {
      const value = rows.find((r) => r.source === source)?.spend_myr ?? 0;
      next[source] = value === 0 ? "" : String(value);
    }
    return next;
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = SOURCES.reduce((acc, source) => acc + (Number(draft[source]) || 0), 0);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveMonthlySpend({
        month,
        spend: SOURCES.map((source) => ({
          source,
          spend_myr: Number(draft[source]) || 0,
        })),
      });
      if (!result.ok) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <Card
      title="Ad spend"
      subtitle={`${formatMonthKey(month)} · entered monthly`}
      className={cx(pending && "opacity-70 transition-opacity")}
      action={
        <input
          type="month"
          value={month}
          max={maxMonth}
          onChange={(e) => {
            if (e.target.value) router.push(`/analysis?month=${e.target.value}`);
          }}
          aria-label="Spend month"
          className="tabular rounded border border-line bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
        />
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SOURCES.map((source: Source) => (
          <label key={source} className="block text-[11px] text-ink-faint">
            {SOURCE_LABELS[source]}
            <input
              type="text"
              inputMode="decimal"
              value={draft[source]}
              onChange={(e) => {
                setDraft({ ...draft, [source]: e.target.value.replace(/[^\d.]/g, "") });
                setSaved(false);
              }}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              className="tabular mt-0.5 w-full rounded border border-line bg-surface-2 px-2 py-1.5 text-right text-xs text-ink outline-none transition-colors focus:border-accent focus:bg-surface-3"
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save spend"}
        </button>
        <span className="tabular text-xs text-ink-muted">Total {formatMYR(total)}</span>
        <span aria-live="polite" className="text-xs">
          {saved ? <span className="text-good">✓ Saved</span> : null}
        </span>
      </div>

      {error ? (
        <p role="alert" className="mt-2 rounded-md border border-bad/40 bg-bad/10 px-2 py-1.5 text-xs text-bad">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
