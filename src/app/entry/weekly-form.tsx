"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, formatDMY, formatWeekOf } from "@/lib/dates";
import type { ContentWeek } from "@/lib/metrics";
import type { AppSettings, WeeklyContent } from "@/lib/types";
import { Card, cx } from "@/components/ui";
import { saveWeeklyContent } from "./actions";
import { SaveBar } from "./entry-form";

/**
 * Vaneese's week. Two numbers, on its own tab, saving to its own table — she can
 * fill this in without ever touching the daily page, and nothing here changes a
 * figure I'm responsible for.
 */
export function WeeklyForm({
  weekStart,
  maxWeek,
  initialRow,
  settings,
  recentWeeks,
  loadError,
}: {
  weekStart: string;
  maxWeek: string;
  initialRow: WeeklyContent | null;
  settings: AppSettings;
  recentWeeks: ContentWeek[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();

  const show = (value: number) => (value === 0 ? "" : String(value));
  const [posts, setPosts] = useState(show(initialRow?.content_posted ?? 0));
  const [blogs, setBlogs] = useState(show(initialRow?.blog_posts ?? 0));
  const [note, setNote] = useState(initialRow?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({
      posts: show(initialRow?.content_posted ?? 0),
      blogs: show(initialRow?.blog_posts ?? 0),
      note: initialRow?.note ?? "",
    })
  );
  const dirty = JSON.stringify({ posts, blogs, note }) !== baseline;

  const toNumber = (value: string) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  function goToWeek(monday: string) {
    if (monday > maxWeek) return;
    startNavigation(() => router.push(`/entry?view=weekly&week=${monday}`));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);

    const result = await saveWeeklyContent({
      week_start: weekStart,
      content_posted: toNumber(posts),
      blog_posts: toNumber(blogs),
      note,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBaseline(JSON.stringify({ posts, blogs, note }));
    setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    router.refresh();
  }

  const isCurrent = weekStart === maxWeek;

  const fields = [
    {
      key: "posts",
      label: "Content posted",
      definition: "Posts published across every channel this week.",
      target: settings.content_target_per_week,
      value: posts,
      set: setPosts,
    },
    {
      key: "blogs",
      label: "Blog posts",
      definition: "Long-form articles published on the site.",
      target: settings.blog_target_per_week,
      value: blogs,
      set: setBlogs,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">
          {isCurrent ? "This week" : "Backfilling"} · {formatDMY(weekStart)} –{" "}
          {formatDMY(addDays(weekStart, 6))}
        </p>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => goToWeek(addDays(weekStart, -7))}
            aria-label="Previous week"
            className="rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            ‹
          </button>
          <span className="tabular rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink">
            {formatWeekOf(weekStart)}
          </span>
          <button
            type="button"
            onClick={() => goToWeek(addDays(weekStart, 7))}
            disabled={!(weekStart < maxWeek)}
            aria-label="Next week"
            className="rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-30 disabled:hover:border-line"
          >
            ›
          </button>
          {!isCurrent ? (
            <button
              type="button"
              onClick={() => goToWeek(maxWeek)}
              className="ml-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              This week
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.5">
        {recentWeeks.map((week) => (
          <button
            key={week.weekStart}
            type="button"
            onClick={() => goToWeek(week.weekStart)}
            title={`${formatWeekOf(week.weekStart)} — ${week.contentPosted} posts, ${week.blogPosts} blogs`}
            className={cx(
              "tabular rounded border px-2 py-1.5 text-center text-[10px] transition-colors",
              week.logged
                ? "border-accent/40 bg-accent/15 text-accent-bright hover:bg-accent/25"
                : "border-dashed border-line-strong text-ink-faint hover:border-warn/50 hover:text-warn",
              week.weekStart === weekStart && "ring-1 ring-accent-bright"
            )}
          >
            {week.weekStart.slice(8)}/{week.weekStart.slice(5, 7)}
            <span className="ml-1 text-ink-muted">{week.logged ? week.contentPosted : "–"}</span>
          </button>
        ))}
      </div>

      {loadError ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load this week: {loadError}
        </p>
      ) : null}

      <Card
        title="This week"
        subtitle="Blank counts as zero. Saving an all-zero week still logs it."
        className={cx(navigating && "opacity-60 transition-opacity")}
        bodyClassName="p-0"
      >
        <div className="divide-y divide-line">
          {fields.map((field) => (
            <label
              key={field.key}
              className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2/40"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium text-ink">{field.label}</span>
                  <span className="tabular text-[11px] text-ink-faint">
                    target {field.target}/week
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">{field.definition}</span>
              </span>

              <input
                type="text"
                inputMode="numeric"
                value={field.value}
                onChange={(e) => {
                  field.set(e.target.value.replace(/[^\d]/g, ""));
                  setSavedAt(null);
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                aria-label={field.label}
                className="tabular w-24 shrink-0 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-right text-lg outline-none transition-colors placeholder:text-ink-faint/40 focus:border-accent focus:bg-surface-3"
              />
            </label>
          ))}
        </div>
      </Card>

      <Card title="Note" subtitle="Optional." bodyClassName="p-3">
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSavedAt(null);
          }}
          rows={2}
          placeholder="Two carousels underperformed, long-form on CRM automation did well…"
          className="w-full resize-y rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-faint/60 focus:border-accent focus:bg-surface-3"
        />
      </Card>

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : null}

      <SaveBar
        saving={saving}
        dirty={dirty}
        savedAt={savedAt}
        onSave={save}
        label="Save week"
      />
    </div>
  );
}
